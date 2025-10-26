import axios from "axios";
import { AuthError } from "./base";
import {
  PlatformUser,
  NewgroundsGatewayRequest,
  NewgroundsGatewayResponse,
  NewgroundsAuthRequest,
} from "../types";
import { SessionManager } from "./sessions";
import { userQueries } from "../database";
import { log } from "../logger";

const NEWGROUNDS_GATEWAY_URL = "https://newgrounds.io/gateway_v3.php";

export class NewgroundsAuth {
  public readonly platform = "newgrounds" as const;

  async checkSessionWithNewgrounds(
    sessionId: string,
  ): Promise<NewgroundsGatewayResponse> {
    const appId = process.env.NEWGROUNDS_APP_ID!;

    log.info("Checking session with Newgrounds", {
      sessionIdLength: sessionId?.length,
      appIdConfigured: !!appId,
      gatewayUrl: NEWGROUNDS_GATEWAY_URL
    });

    try {
      const gatewayRequest: NewgroundsGatewayRequest = {
        app_id: appId,
        session_id: sessionId,
        execute: {
          component: "App.checkSession",
          parameters: {},
        },
      };

      log.info("Sending request to Newgrounds gateway", {
        requestStructure: {
          app_id: appId ? "configured" : "missing",
          session_id: sessionId ? `${sessionId.length} chars` : "missing",
          component: gatewayRequest.execute.component
        }
      });

      const response = await axios.post(
        NEWGROUNDS_GATEWAY_URL,
        gatewayRequest,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      log.info("Newgrounds gateway raw response", {
        status: response.status,
        statusText: response.statusText,
        dataKeys: Object.keys(response.data || {}),
        responseData: response.data
      });

      return response.data as NewgroundsGatewayResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        log.error("Newgrounds API error", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        log.error("Newgrounds gateway error", { error });
      }
      return {
        success: false,
        error: {
          code: -1,
          message: "Failed to communicate with Newgrounds API",
        },
      };
    }
  }

  async authenticateWithSession(
    authRequest: NewgroundsAuthRequest,
  ): Promise<{ sessionId: string; user: PlatformUser }> {
    try {
      log.info("Starting Newgrounds authentication", {
        sessionIdLength: authRequest.session_id?.length,
        sessionIdPrefix: authRequest.session_id?.substring(0, 8) + "...",
        appId: process.env.NEWGROUNDS_APP_ID ? "configured" : "missing"
      });

      const gatewayResponse = await this.checkSessionWithNewgrounds(
        authRequest.session_id,
      );

      log.info("Newgrounds gateway response", {
        success: gatewayResponse.success,
        hasResult: !!gatewayResponse.result,
        hasSession: !!gatewayResponse.result?.data?.session,
        hasUser: !!gatewayResponse.result?.data?.session?.user,
        errorCode: gatewayResponse.error?.code?.toString(),
        errorMessage: gatewayResponse.error?.message
      });

      if (
        !gatewayResponse.success ||
        !gatewayResponse.result?.data?.session?.user
      ) {
        log.error("Newgrounds gateway validation failed", {
          success: gatewayResponse.success,
          hasResult: !!gatewayResponse.result,
          hasData: !!gatewayResponse.result?.data,
          hasSession: !!gatewayResponse.result?.data?.session,
          hasUser: !!gatewayResponse.result?.data?.session?.user,
          errorCode: gatewayResponse.error?.code?.toString(),
          errorMessage: gatewayResponse.error?.message,
          fullResponse: gatewayResponse
        });
        throw new AuthError(
          gatewayResponse.error?.message || "Invalid Newgrounds session",
          this.platform,
        );
      }

      const ngSession = gatewayResponse.result.data.session;
      const ngUser = ngSession.user!;

      log.info("Newgrounds session details", {
        sessionExpired: ngSession.expired,
        userId: ngUser.id.toString(),
        userName: ngUser.name,
        remember: ngSession.remember
      });

      if (ngSession.expired) {
        log.error("Newgrounds session has expired");
        throw new AuthError("Newgrounds session has expired", this.platform);
      }

      const newgroundsUser: PlatformUser = {
        id: ngUser.id.toString(),
        username: ngUser.name,
      };

      const user = await this.createOrUpdateUser(newgroundsUser);

      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "newgrounds",
        platformUserId: newgroundsUser.id,
        platformSessionId: authRequest.session_id,
        username: newgroundsUser.username,
        isAdmin: user.is_admin,
      });

      return { sessionId, user: newgroundsUser };
    } catch (error) {
      log.error("Newgrounds session auth error", {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        "Failed to authenticate with Newgrounds session",
        this.platform,
      );
    }
  }

  async validateSession(sessionId: string): Promise<PlatformUser | null> {
    try {
      const session = await SessionManager.validateSession(sessionId);
      if (!session || session.platform !== "newgrounds") {
        return null;
      }

      if (session.platformSessionId) {
        const gatewayResponse = await this.checkSessionWithNewgrounds(
          session.platformSessionId,
        );

        if (
          !gatewayResponse.success ||
          !gatewayResponse.result?.data?.session?.user
        ) {
          log.info(
            "Newgrounds session no longer valid, invalidating local session",
          );
          return null;
        }

        const ngSession = gatewayResponse.result.data.session;
        const ngUser = ngSession.user!;

        if (ngSession.expired) {
          log.info(
            "Newgrounds session has expired, invalidating local session",
          );
          return null;
        }

        return {
          id: ngUser.id.toString(),
          username: ngUser.name,
        };
      }

      log.info(
        "No platform session ID found, cannot re-validate with Newgrounds",
      );
      return null;
    } catch (error) {
      log.error("Newgrounds session validation error", { error });
      return null;
    }
  }

  private async createOrUpdateUser(newgroundsUser: PlatformUser) {
    let user = await userQueries.findByPlatformId(
      "newgrounds",
      newgroundsUser.id,
    );

    if (!user) {
      user = await userQueries.create(
        "newgrounds",
        newgroundsUser.id,
        newgroundsUser.username,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }
}

export const newgroundsAuth = new NewgroundsAuth();
