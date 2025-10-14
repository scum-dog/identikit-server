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

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
