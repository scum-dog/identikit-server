import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { log } from "./utils/logger";

import authRoutes from "./routes/auth";
import characterRoutes from "./routes/characters";
import adminRoutes from "./routes/admin";
import pingRoutes from "./routes/ping";
import { validateConfig } from "./utils/configValidation";

import "./database";
import { DatabaseScheduler } from "./scheduler";
import { initializeQueue, shutdownQueue } from "./queue";
import { cleanup } from "./utils/oauthPolling";
import { FIFTEEN_MINUTES } from "./utils/constants";

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
  windowMs: FIFTEEN_MINUTES,
  max: 150,
  message: {
    error: "Too many requests from this IP. Please try again later",
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use(globalRateLimit);

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/characters", characterRoutes);
app.use("/ping", pingRoutes);

app.get("/", (req: Request, res: Response) => {
  return res.redirect("https://scum.dog/");
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
  if (req.path.startsWith("/public")) {
    return;
  }
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
  cleanup();
  process.exit(0);
});

process.on("SIGINT", async () => {
  log.info("SIGINT received. Shutting down gracefully...");
  scheduler.stop();
  await shutdownQueue();
  cleanup();
  process.exit(0);
});
