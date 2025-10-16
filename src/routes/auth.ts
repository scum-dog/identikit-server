import { Router, Request, Response } from "express";
import { newgroundsAuth, authenticateUser } from "../auth";
import { validateRequest, oauthCallbackSchema } from "../validation";
import { userQueries, query } from "../database";
import rateLimit from "express-rate-limit";

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
});

// GET /api/auth/newgrounds/url - get newgrounds OAuth URL
router.get("/newgrounds/url", (req: Request, res: Response) => {
  try {
    const state = req.query.state as string;
    const authUrl = newgroundsAuth.getAuthUrl(state);

    res.json({
      authUrl,
      instructions: "Redirect user to this URL for Newgrounds authentication",
    });
  } catch (error) {
    console.error("Get auth URL error:", error);
    res.status(500).json({ error: "Failed to generate authentication URL" });
  }
});

// POST /api/auth/newgrounds/token - complete OAuth authentication
router.post(
  "/newgrounds/token",
  authRateLimit,
  validateRequest(oauthCallbackSchema),
  async (req: Request, res: Response) => {
    try {
      const { code, state } = req.body;

      const { sessionId, user: ngUser } =
        await newgroundsAuth.authenticateWithCode(code);

      let user = await userQueries.findByPlatformId(
        "newgrounds",
        ngUser.id.toString(),
      );

      if (!user) {
        user = await userQueries.create(
          "newgrounds",
          ngUser.id.toString(),
          ngUser.name,
        );
      } else {
        await userQueries.updateLastLogin(user.id);
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          platform: user.platform,
          isAdmin: user.is_admin,
        },
        sessionId: sessionId,
        tokenType: "Bearer",
        message: "Authentication successful",
      });
    } catch (error) {
      console.error("OAuth token exchange error:", error);
      res.status(401).json({
        error: "Authentication failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// POST /api/auth/verify - verify current session
router.post("/verify", authenticateUser, (req: Request, res: Response) => {
  res.json({
    valid: true,
    user: {
      id: req.user!.id,
      username: req.user!.username,
      platform: req.user!.platform,
      isAdmin: req.user!.isAdmin,
    },
  });
});

// GET /api/auth/me - get current user info
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await query(
      "SELECT id, name, created_at, last_edited_at, edit_count FROM characters WHERE user_id = $1 AND is_deleted = false",
      [req.user!.id],
    );

    res.json({
      user: {
        id: req.user!.id,
        username: req.user!.username,
        platform: req.user!.platform,
        isAdmin: req.user!.isAdmin,
      },
      character: character.rows[0] || null,
      hasCharacter: character.rows.length > 0,
    });
  } catch (error) {
    console.error("Get user info error:", error);
    res.status(500).json({ error: "Failed to get user information" });
  }
});

// POST /api/auth/logout - logout (mainly for client-side cleanup)
router.post("/logout", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Logout successful. Clear your session token.",
  });
});

export default router;
