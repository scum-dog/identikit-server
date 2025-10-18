import { Router, Request, Response } from "express";
import { authenticateUser } from "../../auth/middleware";
import { query } from "../../database";
import { CharacterInfo } from "../../types";

import newgroundsRoutes from "./newgrounds";
import itchRoutes from "./itch";
import googleRoutes from "./google";

const router = Router();

router.use("/newgrounds", newgroundsRoutes);
router.use("/itchio", itchRoutes);
router.use("/google", googleRoutes);

// POST /auth/verify - verify current session
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

// GET /auth/me - get current user info
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await query<CharacterInfo>(
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

// POST /auth/logout - logout (mainly for client-side cleanup)
router.post("/logout", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Logout successful. Clear your session token.",
  });
});

export default router;
