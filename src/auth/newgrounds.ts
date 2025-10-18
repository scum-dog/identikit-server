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
      console.error("Newgrounds gateway error:", error);
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
