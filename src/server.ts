import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import characterRoutes from "./routes/characters";
import adminRoutes from "./routes/admin";
import mockAuthRoutes from "./routes/mock-auth";
import mockCharacterRoutes from "./routes/mock-characters";
import mockAdminRoutes from "./routes/mock-admin";
import { validateConfig } from "./auth/configValidation";
import "./database";

dotenv.config();
validateConfig();

const app = express();
const PORT = process.env.PORT || 3000;
const environment = process.env.NODE_ENV || "development";

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many requests from this IP. Please try again later",
  },
});

app.use(globalRateLimit);

app.get("/ping", (req: Request, res: Response) => {
  res.json({
    message: "pong",
    timestamp: new Date().toISOString(),
    environment: environment,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/admin", adminRoutes);

app.use("/mock/api/auth", mockAuthRoutes);
app.use("/mock/api/characters", mockCharacterRoutes);
app.use("/mock/api/admin", mockAdminRoutes);

app.get("/api", (req: Request, res: Response) => {
  res.json({
    endpoints: {
      system: {
        "GET /ping": "Pong (hopefully)",
      },
      auth: {
        "GET /api/auth/newgrounds/url": "Get Newgrounds OAuth URL",
        "GET /api/auth/itchio/url": "Get Itch.io OAuth URL",
        "GET /api/auth/google/url": "Get Google OAuth URL",
        "POST /api/auth/verify": "Verify current session",
        "GET /api/auth/me": "Get current user info",
        "POST /api/auth/logout": "Logout",
      },
      characters: {
        "GET /api/characters/me": "Get user's character",
        "POST /api/characters": "Create new character",
        "PUT /api/characters/me": "Update user's character",
        "GET /api/characters/plaza": "Get plaza characters",
        "GET /api/characters/:id": "Get character by ID",
      },
      admin: {
        "GET /api/admin/characters": "List all characters (admin)",
        "GET /api/admin/character/:id": "Get character details (admin)",
        "DELETE /api/admin/character/:id": "Delete character (admin)",
        "GET /api/admin/users": "List all users (admin)",
        "GET /api/admin/actions": "Get admin action history",
        "GET /api/admin/stats": "Get platform statistics",
      },
      oauth_callbacks: {
        "GET /api/auth/newgrounds/callback":
          "Newgrounds OAuth callback (internal use)",
        "GET /api/auth/itchio/callback":
          "Itch.io OAuth callback (internal use)",
        "GET /api/auth/google/callback": "Google OAuth callback (internal use)",
      },
      testing: {
        "GET /test-retry": "Testing endpoint for various failure types",
      },
      mock: {
        "GET /mock/api/auth/newgrounds/me": "Mock Newgrounds user info",
        "GET /mock/api/auth/itch/me": "Mock itch.io user info",
        "GET /mock/api/auth/google/me": "Mock Google user info",
        "GET /mock/api/characters/me": "Mock user's character",
        "POST /mock/api/characters": "Mock character creation",
        "PUT /mock/api/characters/me": "Mock character update",
        "GET /mock/api/characters/plaza": "Mock plaza characters",
        "GET /mock/api/characters/:id": "Mock character by ID",
        "GET /mock/api/admin/characters": "Mock admin character list",
        "GET /mock/api/admin/character/:id": "Mock admin character details",
        "DELETE /mock/api/admin/character/:id": "Mock admin character deletion",
        "GET /mock/api/admin/users": "Mock admin user list",
        "GET /mock/api/admin/actions": "Mock admin action history",
        "GET /mock/api/admin/stats": "Mock platform statistics",
      },
    },
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

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error",
    message:
      environment === "development" ? error.message : "Something went wrong",
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT} in ${environment}`);
});
