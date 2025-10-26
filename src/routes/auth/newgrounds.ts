import { Router, Request, Response } from "express";
import { newgroundsAuth } from "../../auth/newgrounds";
import { NewgroundsAuthRequest } from "../../types";
import { newgroundsAuthSchema } from "../../validation";
import { log } from "../../logger";

const router = Router();

// POST /auth/newgrounds/authenticate - authenticate with Newgrounds session
router.post("/authenticate", async (req: Request, res: Response) => {
  try {
    const validationResult = newgroundsAuthSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "Invalid request parameters",
        details: validationResult.error.issues,
      });
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
    res.status(401).json({
      success: false,
      error: "authentication_failed",
      message: "Newgrounds authentication failed",
    });
  }
});

export default router;
