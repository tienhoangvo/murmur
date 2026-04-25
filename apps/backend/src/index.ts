import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { createServer } from "http";
import { initSocketServer } from "./ws/server.js";
import authRouter from "./routes/auth.js";
import teamsRouter from "./routes/teams.js";
import boardsRouter from "./routes/boards.js";
import invitesRouter from "./routes/invites.js";
import { AppError } from "./lib/errors.js";

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/boards", boardsRouter);
app.use("/api/invites", invitesRouter);

// global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

initSocketServer(httpServer);

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`🚀 murmur backend running on port ${PORT}`);
});
