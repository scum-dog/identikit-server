import { Router, Request, Response } from "express";
import { newgroundsAuth } from "../../auth/newgrounds";
import { NewgroundsAuthRequest } from "../../types";
import { newgroundsAuthSchema } from "../../utils/validation";
import { log } from "../../utils/logger";
import { getConstraintError, errorResponse } from "../../utils/errorHandler";
import { ERROR_CODES } from "../../utils/constants";

const router = Router();

// POST /auth/newgrounds/authenticate - authenticate with Newgrounds session
router.post("/authenticate", async (req: Request, res: Response) => {
  try {
    const validationResult = newgroundsAuthSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res
        .status(400)
        .json(
          errorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            "Invalid Newgrounds authentication parameters",
            { issues: validationResult.error.issues },
          ),
        );
    }

    const authRequest: NewgroundsAuthRequest = {
      session_id: validationResult.data.session_id,
    };

    const { sessionId, user: ngUser } =
      await newgroundsAuth.authenticateWithSession(authRequest);

    res.json({
      success: true,
      sessionId,
      user: {
        id: ngUser.id,
        username: ngUser.username,
        platform: "newgrounds",
      },
      message: "Newgrounds authentication successful",
    });
  } catch (error) {
    log.error("Newgrounds authentication error", { error });

    const constraintError = getConstraintError(error);
    if (constraintError) {
      return res
        .status(400)
        .json(errorResponse(constraintError.error, constraintError.message));
    }

    if (error instanceof Error) {
      if (error.message.includes("Invalid Newgrounds session")) {
        return res
          .status(401)
          .json(
            errorResponse(
              ERROR_CODES.INVALID_TOKEN,
              "Your Newgrounds session is invalid. Please log in to Newgrounds and try again.",
            ),
          );
      }

      if (error.message.includes("session has expired")) {
        return res
          .status(401)
          .json(
            errorResponse(
              ERROR_CODES.EXPIRED_TOKEN,
              "Your Newgrounds session has expired. Please refresh Newgrounds and try again.",
            ),
          );
      }

      if (error.message.includes("Failed to communicate")) {
        return res
          .status(503)
          .json(
            errorResponse(
              ERROR_CODES.NETWORK_ERROR,
              "Unable to connect to Newgrounds servers. Please try again later.",
            ),
          );
      }
    }

    res
      .status(500)
      .json(
        errorResponse(
          ERROR_CODES.PLATFORM_ERROR,
          "Newgrounds authentication failed due to an unexpected error",
        ),
      );
  }
});

export default router;
