import { Router, Request, Response } from "express";
import { googleAuth } from "../../auth/google";
import { userQueries } from "../../database";

const router = Router();

router.get("/url", async (req: Request, res: Response) => {
  try {
    const { authUrl, state, expiresAt } = googleAuth.generateAuthUrl();
    res.json({ authUrl, state, expiresAt });
  } catch (error) {
    console.error("Google auth URL error:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// GET /api/auth/google/callback - OAuth callback endpoint
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: "missing_parameters",
        message: "Missing code or state parameter",
      });
    }

    const { sessionId, user: googleUser } =
      await googleAuth.authenticateWithCode(code as string, state as string);
    const user = await userQueries.findByPlatformId("google", googleUser.id);

    if (!user) {
      throw new Error("User not found after OAuth flow");
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
    console.error("Google callback error:", error);
    res.status(401).json({
      success: false,
      error: "authentication_failed",
      message: "Google authentication failed",
    });
  }
});

export default router;
