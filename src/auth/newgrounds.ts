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

    try {
      const gatewayRequest: NewgroundsGatewayRequest = {
        app_id: appId,
        session_id: sessionId,
        execute: {
          component: "App.checkSession",
          parameters: {},
        },
      };

      const response = await axios.post(
        NEWGROUNDS_GATEWAY_URL,
        gatewayRequest,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

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
      const gatewayResponse = await this.checkSessionWithNewgrounds(
        authRequest.session_id,
      );

      if (
        !gatewayResponse.success ||
        !gatewayResponse.result?.data?.session?.user
      ) {
        throw new AuthError(
          gatewayResponse.error?.message || "Invalid Newgrounds session",
          this.platform,
        );
      }

      const ngSession = gatewayResponse.result.data.session;
      const ngUser = ngSession.user!;

      if (ngSession.expired) {
        throw new AuthError("Newgrounds session has expired", this.platform);
      }

      const newgroundsUser: PlatformUser = {
        id: ngUser.id.toString(),
        username: ngUser.username,
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
      log.error("Newgrounds session auth error", { error });
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
          username: ngUser.username,
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
