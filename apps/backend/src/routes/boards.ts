import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import * as boardService from "../services/boardService.js";

const router: ExpressRouter = Router();

const createBoardSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1).max(100).default("Untitled board"),
});

// GET /api/boards?teamId=xxx
router.get("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const teamId = req.query["teamId"] as string | undefined;
    if (!teamId) {
      res.status(400).json({ message: "teamId query param required" });
      return;
    }
    const result = await boardService.getBoardsForTeam(
      teamId,
      req.user!.userId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/boards
router.post("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { teamId, name } = createBoardSchema.parse(req.body);
    const board = await boardService.createBoard(
      teamId,
      name,
      req.user!.userId,
    );
    res.status(201).json(board);
  } catch (err) {
    next(err);
  }
});

// GET /api/boards/:boardId
router.get("/:boardId", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await boardService.getBoardById(
      req.params["boardId"] as string,
      req.user!.userId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/boards/:boardId/snapshot
router.get(
  "/:boardId/snapshot",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const snapshot = await boardService.getBoardSnapshot(
        req.params["boardId"] as string,
        req.user!.userId,
      );
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/boards/:boardId
router.delete(
  "/:boardId",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await boardService.deleteBoard(
        req.params["boardId"] as string,
        req.user!.userId,
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
