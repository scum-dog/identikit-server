import { Router, Request, Response } from "express";
import {
  getOAuthResult,
  removeOAuthResult,
  generatePollId,
  storeOAuthResult,
} from "../../utils/oauthPolling";
import { log } from "../../utils/logger";

const router = Router();

// GET /auth/oauth/poll-id - generate a new polling ID
router.get("/poll-id", (req: Request, res: Response) => {
  try {
    const pollId = generatePollId();

    res.json({
      success: true,
      pollId,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
  } catch (error) {
    log.error("Failed to generate polling ID", { error });
    res.status(500).json({
      success: false,
      error: "internal_error",
      message: "Failed to generate polling ID",
    });
  }
});

// GET /auth/oauth/poll/:pollId - poll for OAuth result
router.get("/poll/:pollId", (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;

    if (!pollId || typeof pollId !== "string") {
      return res.status(400).json({
        success: false,
        error: "invalid_poll_id",
        message: "Invalid polling ID",
      });
    }

    const result = getOAuthResult(pollId);

    if (!result) {
      return res.json({
        success: false,
        status: "pending",
        message: "OAuth flow still in progress",
      });
    }

    log.info("OAuth result retrieved", {
      pollId,
      success: result.success,
      hasSessionId: !!result.sessionId,
    });

    removeOAuthResult(pollId);

    res.json({
      success: result.success,
      sessionId: result.sessionId,
      user: result.user,
      message: result.message,
      error: result.error,
      status: "completed",
    });
  } catch (error) {
    log.error("OAuth polling error", { error, pollId: req.params.pollId });
    res.status(500).json({
      success: false,
      error: "internal_error",
      message: "Failed to retrieve OAuth result",
    });
  }
});

// POST /auth/oauth/store/:pollId - store OAuth result from callback
router.post("/store/:pollId", (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const oauthResult = req.body;

    if (!pollId || typeof pollId !== "string") {
      return res.status(400).json({
        success: false,
        error: "invalid_poll_id",
        message: "Invalid polling ID",
      });
    }

    if (!oauthResult || typeof oauthResult !== "object") {
      return res.status(400).json({
        success: false,
        error: "invalid_data",
        message: "Invalid OAuth result data",
      });
    }

    storeOAuthResult(pollId, {
      success: oauthResult.success || false,
      sessionId: oauthResult.sessionId,
      user: oauthResult.user,
      message: oauthResult.message,
      error: oauthResult.error,
    });

    log.info("OAuth result stored via callback", {
      pollId,
      success: oauthResult.success,
      hasSessionId: !!oauthResult.sessionId,
    });

    res.json({
      success: true,
      message: "OAuth result stored successfully",
    });
  } catch (error) {
    log.error("OAuth storage error", { error, pollId: req.params.pollId });
    res.status(500).json({
      success: false,
      error: "internal_error",
      message: "Failed to store OAuth result",
    });
  }
});

export default router;
