import axios from "axios";
import { AuthError } from "./base";
import {
  NewgroundsUser,
  NewgroundsGatewayRequest,
  NewgroundsGatewayResponse,
  NewgroundsAuthRequest,
} from "../types";
import { SessionManager } from "./sessions";
import { userQueries } from "../database";

const NEWGROUNDS_GATEWAY_URL = "https://newgrounds.io/gateway_v3.php";

export class NewgroundsAuth {
  public readonly platform = "newgrounds" as const;

  async startSession(): Promise<{ sessionId: string; passportUrl?: string }> {
    const appId = process.env.NEWGROUNDS_APP_ID!;

    try {
      const gatewayRequest: NewgroundsGatewayRequest = {
        app_id: appId,
        execute: {
          component: "App.startSession",
          parameters: {},
        },
      };

      console.log("Starting new Newgrounds session:", {
        url: NEWGROUNDS_GATEWAY_URL,
        appId,
        component: "App.startSession",
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

      console.log("Newgrounds startSession response:", {
        success: response.data.success,
        hasResult: !!response.data.result,
        hasSession: !!response.data.result?.session,
        sessionId: response.data.result?.session?.id
          ? response.data.result.session.id.substring(0, 8) + "..."
          : "none",
        passportUrl: !!response.data.result?.session?.passport_url,
        error: response.data.error,
      });

      console.log("Full startSession response:", JSON.stringify(response.data, null, 2));

      if (!response.data.success || !response.data.result?.session?.id) {
        throw new Error(
          response.data.error?.message || "Failed to start session",
        );
      }

      const session = response.data.result.session;
      return {
        sessionId: session.id,
        passportUrl: session.passport_url,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Newgrounds startSession API error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        console.error("Newgrounds startSession error:", error);
      }
      throw new Error("Failed to start Newgrounds session");
    }
  }

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

      console.log("Sending Newgrounds request:", {
        url: NEWGROUNDS_GATEWAY_URL,
        appId,
        sessionId: sessionId.substring(0, 8) + "...",
        component: "App.checkSession",
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

      console.log("Newgrounds response:", {
        success: response.data.success,
        hasResult: !!response.data.result,
        hasSession: !!response.data.result?.session,
        hasUser: !!response.data.result?.session?.user,
        error: response.data.error,
      });

      return response.data as NewgroundsGatewayResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Newgrounds API error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        console.error("Newgrounds gateway error:", error);
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
  ): Promise<{ sessionId: string; user: NewgroundsUser }> {
    try {
      const gatewayResponse = await this.checkSessionWithNewgrounds(
        authRequest.session_id,
      );

      if (!gatewayResponse.success || !gatewayResponse.result?.session?.user) {
        throw new AuthError(
          gatewayResponse.error?.message || "Invalid Newgrounds session",
          this.platform,
        );
      }

      const ngSession = gatewayResponse.result.session;
      const ngUser = ngSession.user!;

      if (ngSession.expired) {
        throw new AuthError("Newgrounds session has expired", this.platform);
      }

      const newgroundsUser: NewgroundsUser = {
        id: ngUser.id,
        name: ngUser.name,
        username: ngUser.name,
        supporter: ngUser.supporter,
      };

      const user = await this.createOrUpdateUser(newgroundsUser);

      const sessionId = await SessionManager.createSession({
        userId: user.id,
        platform: "newgrounds",
        platformUserId: newgroundsUser.id.toString(),
        platformSessionId: authRequest.session_id,
        username: newgroundsUser.username,
        isAdmin: user.is_admin,
      });

      return { sessionId, user: newgroundsUser };
    } catch (error) {
      console.error("Newgrounds session auth error:", error);
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        "Failed to authenticate with Newgrounds session",
        this.platform,
      );
    }
  }

  async validateSession(sessionId: string): Promise<NewgroundsUser | null> {
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
          !gatewayResponse.result?.session?.user
        ) {
          console.log(
            "Newgrounds session no longer valid, invalidating local session",
          );
          return null;
        }

        const ngSession = gatewayResponse.result.session;
        const ngUser = ngSession.user!;

        if (ngSession.expired) {
          console.log(
            "Newgrounds session has expired, invalidating local session",
          );
          return null;
        }

        return {
          id: ngUser.id,
          name: ngUser.name,
          username: ngUser.name,
          supporter: ngUser.supporter,
        };
      }

      console.log(
        "No platform session ID found, cannot re-validate with Newgrounds",
      );
      return null;
    } catch (error) {
      console.error("Newgrounds session validation error:", error);
      return null;
    }
  }

  private async createOrUpdateUser(newgroundsUser: NewgroundsUser) {
    let user = await userQueries.findByPlatformId(
      "newgrounds",
      newgroundsUser.id.toString(),
    );

    if (!user) {
      user = await userQueries.create(
        "newgrounds",
        newgroundsUser.id.toString(),
        newgroundsUser.username,
        undefined,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
    }

    return user;
  }
}

export const newgroundsAuth = new NewgroundsAuth();
