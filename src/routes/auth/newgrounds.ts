import { Router, Request, Response } from "express";
import { newgroundsAuth } from "../../auth/newgrounds";
import { NewgroundsAuthRequest } from "../../types";
import { newgroundsAuthSchema } from "../../validation";

const router = Router();

// POST /auth/newgrounds/start-session - create new Newgrounds session for testing
router.post("/start-session", async (req: Request, res: Response) => {
  try {
    const { sessionId, passportUrl } = await newgroundsAuth.startSession();

    res.json({
      success: true,
      sessionId,
      passportUrl,
      message: "New Newgrounds session created",
    });
  } catch (error) {
    console.error("Newgrounds start session error:", error);
    res.status(500).json({
      success: false,
      error: "session_creation_failed",
      message: "Failed to create Newgrounds session",
    });
  }
});

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
        supporter: ngUser.supporter,
      },
      message: "Newgrounds authentication successful",
    });
  } catch (error) {
    console.error("Newgrounds authentication error:", error);
    res.status(401).json({
      success: false,
      error: "authentication_failed",
      message: "Newgrounds authentication failed",
    });
  }
});

export default router;
