import { Router, Request, Response } from "express";

const router = Router();

const environment = process.env.NODE_ENV || "development";

router.get("/", (req: Request, res: Response) => {
  res.json({
    message: "pong",
    timestamp: new Date().toISOString(),
    environment: environment,
  });
});

export default router;
