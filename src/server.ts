import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import characterRoutes from "./routes/characters";
import adminRoutes from "./routes/admin";
import mockCharacterRoutes from "./routes/mock-characters";
import mockAdminRoutes from "./routes/mock-admin";
import testRetryRoutes from "./routes/test-retry";
import pingRoutes from "./routes/ping";
import { validateConfig } from "./utils/configValidation";
import "./database";
import { DatabaseScheduler } from "./scheduler";
import { initializeQueue, shutdownQueue } from "./queue";
import { log } from "./utils/logger";

dotenv.config({ quiet: true });
validateConfig();

const app = express();
const PORT = process.env.PORT || 3000;
const environment = process.env.NODE_ENV || "development";
const scheduler = new DatabaseScheduler();

if (environment === "production") {
  app.set("trust proxy", 1);
}

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
app.use("/public", express.static("public"));

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many requests from this IP. Please try again later",
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use(globalRateLimit);
app.use("/ping", pingRoutes);

app.use("/auth", authRoutes);
app.use("/characters", characterRoutes);
app.use("/admin", adminRoutes);

app.use("/mock/characters", mockCharacterRoutes);
app.use("/mock/admin", mockAdminRoutes);
app.use("/test-retry", testRetryRoutes);

app.get("/", (req: Request, res: Response) => {
  if (environment === "production") {
    return res.redirect("https://scum.dog/404");
  }

  res.json({
    endpoints: {
      testing: {
        "GET /ping": "Pong (hopefully)",
        "GET /test-retry": "Testing endpoint for various failure types",
      },
      auth: {
        "POST /auth/newgrounds/authenticate":
          "Authenticate with Newgrounds session",
        "GET /auth/itchio/authorization-url":
          "Get Itch.io OAuth authorization URL",
        "GET /auth/google/authorization-url":
          "Get Google OAuth authorization URL",
        "GET /auth/session": "Verify current session",
        "GET /auth/me": "Get current user info",
        "DELETE /auth/session": "Logout with serverside cleanup",
      },
      characters: {
        "GET /characters/me": "Get user's character",
        "POST /characters": "Create new character",
        "PUT /characters/me": "Update user's character",
        "GET /characters?view=plaza": "Get characters for plaza display",
        "GET /characters/:id": "Get character by ID",
      },
      admin: {
        "GET /admin/characters": "List all characters (admin)",
        "GET /admin/characters/:id": "Get character details (admin)",
        "DELETE /admin/characters/:id": "Delete character (admin)",
        "GET /admin/users": "List all users (admin)",
      },
      callbacks: {
        "GET /auth/itchio/callback": "Itch.io OAuth callback (internal use)",
        "POST /auth/itchio/callback":
          "Itch.io OAuth token handler (internal use)",
        "GET /auth/google/callback": "Google OAuth callback (internal use)",
      },
      mocks: {
        "GET /mock/characters/me": "Mock user's character",
        "POST /mock/characters": "Mock character creation",
        "PUT /mock/characters/me": "Mock character update",
        "GET /mock/characters?view=plaza": "Mock characters for plaza display",
        "GET /mock/characters/:id": "Mock character by ID",
        "GET /mock/admin/characters": "Mock admin character list",
        "GET /mock/admin/characters/:id": "Mock admin character details",
        "DELETE /mock/admin/characters/:id": "Mock admin character deletion",
        "GET /mock/admin/users": "Mock admin user list",
      },
    },
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  log.error("Global error handler:", {
    error: error.message,
    stack: error.stack,
  });

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

app.listen(PORT, async () => {
  log.info(`listening on port ${PORT} in ${environment}`);
  scheduler.start();
  await initializeQueue();
  log.info("Job queue initialized and resumed processing");
});

process.on("SIGTERM", async () => {
  log.info("SIGTERM received. Shutting down gracefully...");
  scheduler.stop();
  await shutdownQueue();
  process.exit(0);
});

process.on("SIGINT", async () => {
  log.info("SIGINT received. Shutting down gracefully...");
  scheduler.stop();
  await shutdownQueue();
  process.exit(0);
});
