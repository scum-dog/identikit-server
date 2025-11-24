import { Router, Request, Response } from "express";
import { googleAuth } from "../../auth/google";
import { userQueries } from "../../database";
import { log } from "../../utils/logger";
import {
  getConstraintError,
  ERROR_CODES,
  errorResponse,
} from "../../utils/errorHandler";

const router = Router();

router.get("/authorization-url", async (req: Request, res: Response) => {
  try {
    const { authUrl, state, expiresAt } = await googleAuth.generateAuthUrl();
    res.json({ authUrl, state, expiresAt });
  } catch (error) {
    log.error("Google auth URL error", { error });
    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Failed to generate Google authentication URL",
        ),
      );
  }
});

const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res
        .status(400)
        .json(
          errorResponse(
            ERROR_CODES.MISSING_PARAMETERS,
            "Missing required authentication parameters (code or state)",
          ),
        );
    }

    const { sessionId, user: googleUser } =
      await googleAuth.authenticateWithCode(code as string, state as string);
    const user = await userQueries.findByPlatformId("google", googleUser.id);

    if (!user) {
      return res
        .status(500)
        .json(
          errorResponse(
            ERROR_CODES.USER_NOT_FOUND,
            "User account was not properly created during authentication",
          ),
        );
    }

    res.json({
      success: true,
      sessionId,
      user: {
        id: user.id,
        username: user.username,
        platform: user.platform,
        isAdmin: user.is_admin || false,
      },
      message: "Google authentication successful",
    });
  } catch (error) {
    log.error("Google callback error", { error });

    const constraintError = getConstraintError(error);
    if (constraintError) {
      return res
        .status(400)
        .json(errorResponse(constraintError.error, constraintError.message));
    }

    if (error instanceof Error) {
      if (
        error.message.includes("invalid_grant") ||
        error.message.includes("authorization code")
      ) {
        return res
          .status(400)
          .json(
            errorResponse(
              ERROR_CODES.INVALID_TOKEN,
              "Invalid or expired Google authorization code. Please try signing in again.",
            ),
          );
      }

      if (
        error.message.includes("network") ||
        error.message.includes("timeout")
      ) {
        return res
          .status(503)
          .json(
            errorResponse(
              ERROR_CODES.NETWORK_ERROR,
              "Unable to connect to Google's servers. Please try again later.",
            ),
          );
      }
    }

    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Google authentication failed due to an unexpected error",
        ),
      );
  }
};

router.get("/callback", handleGoogleCallback);

export default router;
