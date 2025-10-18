import { Router, Request, Response } from "express";
import { itchAuth } from "../../auth/itch";
import { userQueries } from "../../database";

const router = Router();

// GET /auth/itchio/url - get itch.io OAuth URL
router.get("/url", (req: Request, res: Response) => {
  try {
    const { authUrl, state, expiresAt } = itchAuth.generateAuthUrl();

    res.json({
      authUrl,
      state,
      expiresAt,
    });
  } catch (error) {
    console.error("Get itch.io auth URL error:", error);
    res.status(500).json({ error: "Failed to generate authentication URL" });
  }
});

// GET /auth/itchio/callback - OAuth callback endpoint
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { access_token, state } = req.query;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: "missing_parameters",
        message: "Missing access_token parameter",
      });
    }

    const { sessionId, user: itchUser } = await itchAuth.authenticateWithCode(
      access_token as string,
      state as string,
    );

    const user = await userQueries.findByPlatformId(
      "itchio",
      itchUser.id.toString(),
    );

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
      message: "Itch.io authentication successful",
    });
  } catch (error) {
    console.error("Itch.io callback error:", error);
    res.status(401).json({
      success: false,
      error: "authentication_failed",
      message: "Itch.io authentication failed",
    });
  }
});

export default router;
