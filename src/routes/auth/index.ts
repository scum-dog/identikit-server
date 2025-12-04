import { Router, Request, Response } from "express";
import { authenticateUser } from "../../auth/middleware";
import { query } from "../../database";
import { CharacterBasicInfo } from "../../types";
import { log } from "../../utils/logger";
import { SessionManager } from "../../auth/sessions";

import newgroundsRoutes from "./newgrounds";
import itchRoutes from "./itch";
import googleRoutes from "./google";
import pollingRoutes from "./polling";

const router = Router();

router.use("/newgrounds", newgroundsRoutes);
router.use("/itchio", itchRoutes);
router.use("/google", googleRoutes);
router.use("/oauth", pollingRoutes);

// GET /auth/session - verify current session
router.get("/session", authenticateUser, (req: Request, res: Response) => {
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
    const character = await query<CharacterBasicInfo>(
      "SELECT id, created_at, last_edited_at FROM characters WHERE user_id = $1 AND is_deleted = false",
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
    log.error("Get user info error", { error });
    res.status(500).json({ error: "Failed to get user information" });
  }
});

// DELETE /auth/session - logout with serverside cleanup
router.delete(
  "/session",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const sessionId = authHeader.substring(7);
        await SessionManager.deleteSession(sessionId);
      }

      res.json({
        success: true,
        message: "Logout successful. Session cleared from server.",
      });
    } catch (error) {
      log.error("Logout error", { error });
      res.status(500).json({ error: "Logout failed" });
    }
  },
);

export default router;
