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
import testRetryRoutes from "./routes/test-retry";
import pingRoutes from "./routes/ping";
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
app.use("/ping", pingRoutes);

app.use("/auth", authRoutes);
app.use("/characters", characterRoutes);
app.use("/admin", adminRoutes);

app.use("/mock/auth", mockAuthRoutes);
app.use("/mock/characters", mockCharacterRoutes);
app.use("/mock/admin", mockAdminRoutes);
app.use("/test-retry", testRetryRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({
    endpoints: {
      system: {
        "GET /ping": "Pong (hopefully)",
      },
      auth: {
        "POST /auth/newgrounds/authenticate":
          "Authenticate with Newgrounds session",
        "GET /auth/itchio/url": "Get Itch.io OAuth URL",
        "GET /auth/google/url": "Get Google OAuth URL",
        "POST /auth/verify": "Verify current session",
        "GET /auth/me": "Get current user info",
        "POST /auth/logout": "Logout (mainly for client cleanup)",
      },
      characters: {
        "GET /characters/me": "Get user's character",
        "POST /characters": "Create new character",
        "PUT /characters/me": "Update user's character",
        "GET /characters/plaza": "Get plaza characters",
        "GET /characters/:id": "Get character by ID",
      },
      admin: {
        "GET /admin/characters": "List all characters (admin)",
        "GET /admin/character/:id": "Get character details (admin)",
        "DELETE /admin/character/:id": "Delete character (admin)",
        "GET /admin/users": "List all users (admin)",
      },
      oauth_callbacks: {
        "GET /auth/itchio/callback": "Itch.io OAuth callback (internal use)",
        "POST /auth/itchio/callback":
          "Itch.io OAuth token handler (internal use)",
        "GET /auth/google/callback": "Google OAuth callback (internal use)",
      },
      testing: {
        "GET /test-retry": "Testing endpoint for various failure types",
      },
      mock: {
        "GET /mock/auth/me": "Mock user info",
        "GET /mock/characters/me": "Mock user's character",
        "POST /mock/characters": "Mock character creation",
        "PUT /mock/characters/me": "Mock character update",
        "GET /mock/characters/plaza": "Mock plaza characters",
        "GET /mock/characters/:id": "Mock character by ID",
        "GET /mock/admin/characters": "Mock admin character list",
        "GET /mock/admin/character/:id": "Mock admin character details",
        "DELETE /mock/admin/character/:id": "Mock admin character deletion",
        "GET /mock/admin/users": "Mock admin user list",
      },
    },
  });
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
