import { Router, Request, Response } from "express";
import { newgroundsAuth } from "../../auth/newgrounds";
import { userQueries } from "../../database";

const router = Router();

// GET /api/auth/newgrounds/url - get newgrounds OAuth URL
router.get("/url", (req: Request, res: Response) => {
  try {
    const { authUrl, state, expiresAt } = newgroundsAuth.generateAuthUrl();

    res.json({
      authUrl,
      state,
      expiresAt,
      instructions: "Redirect user to this URL for Newgrounds authentication",
    });
  } catch (error) {
    console.error("Get Newgrounds auth URL error:", error);
    res.status(500).json({ error: "Failed to generate authentication URL" });
  }
});

// GET /api/auth/newgrounds/callback - OAuth callback endpoint
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "missing_parameters",
        message: "Missing code parameter",
      });
    }

    const { sessionId, user: ngUser } =
      await newgroundsAuth.authenticateWithCode(
        code as string,
        state as string,
      );

    let user = await userQueries.findByPlatformId(
      "newgrounds",
      ngUser.id.toString(),
    );

    if (!user) {
      user = await userQueries.create(
        "newgrounds",
        ngUser.id.toString(),
        ngUser.username,
      );
    } else {
      await userQueries.updateLastLogin(user.id);
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
      message: "Newgrounds authentication successful",
    });
  } catch (error) {
    console.error("Newgrounds callback error:", error);
    res.status(401).json({
      success: false,
      error: "authentication_failed",
      message: "Newgrounds authentication failed",
    });
  }
});

export default router;
