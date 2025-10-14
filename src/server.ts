import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/ping", (req: Request, res: Response) => {
  res.json({
    message: "pong",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get("/test-retry", (req: Request, res: Response) => {
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

    case "random":
    default:
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
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
