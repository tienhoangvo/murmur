import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import * as inviteService from "../services/inviteService.js";

const router: ExpressRouter = Router();

const createInviteSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["owner", "editor", "viewer"]).default("editor"),
});

// GET /api/invites?teamId=xxx
router.get("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const teamId = req.query["teamId"] as string | undefined;
    if (!teamId) {
      res.status(400).json({ message: "teamId query param required" });
      return;
    }
    const result = await inviteService.getTeamInvites(teamId, req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/invites — create an invite
router.post("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { teamId, email, role } = createInviteSchema.parse(req.body);
    const invite = await inviteService.createInvite(
      teamId,
      email,
      role,
      req.user!.userId,
    );
    res.status(201).json(invite);
  } catch (err) {
    next(err);
  }
});

// POST /api/invites/:token/accept — accept an invite
router.post(
  "/:token/accept",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const result = await inviteService.acceptInvite(
        req.params["token"] as string,
        req.user!.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/invites/:inviteId — revoke an invite
router.delete(
  "/:inviteId",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await inviteService.revokeInvite(
        req.params["inviteId"] as string,
        req.user!.userId,
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
