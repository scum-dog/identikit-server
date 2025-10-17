import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const failureType = (req.query.type as string) || "random";
  const attempt = parseInt(req.query.attempt as string) || 1;

  switch (failureType) {
    case "timeout":
      setTimeout(() => {
        res.json({
          message: "Finally responded after delay",
          attempt,
          timestamp: new Date().toISOString(),
        });
      }, 5000);
      break;

    case "intermittent":
      if (attempt >= 3) {
        res.json({
          message: "Success after intermittent failures",
          attempt,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          error: "Service temporarily unavailable",
          attempt,
          message: "Try again later",
        });
      }
      break;

    case "500":
      res.status(500).json({
        error: "Internal server error",
        attempt,
        message: "Something went wrong on the server",
      });
      break;

    case "502":
      res.status(502).json({
        error: "Bad gateway",
        attempt,
        message: "Upstream server error",
      });
      break;

    case "503":
      res.status(503).json({
        error: "Service unavailable",
        attempt,
        message: "Server is temporarily overloaded",
      });
      break;

    case "network":
      req.socket.destroy();
      break;

    case "hang":
      // do literally nothing
      break;

    case "random":
    default: {
      const shouldFail = Math.random() < 0.7;
      if (shouldFail) {
        const errorCodes = [500, 502, 503, 504];
        const randomCode =
          errorCodes[Math.floor(Math.random() * errorCodes.length)];
        res.status(randomCode).json({
          error: "Random failure occurred",
          code: randomCode,
          attempt,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.json({
          message: "Random success!",
          attempt,
          timestamp: new Date().toISOString(),
        });
      }
      break;
    }
  }
});

export default router;
