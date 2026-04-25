import { Router } from "express";
import { Router as ExpressRouter } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import * as teamService from "../services/teamService.js";

const router: ExpressRouter = Router();

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "editor", "viewer"]),
});

// GET /api/teams — all teams for current user
router.get("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const teams = await teamService.getTeamsForUser(req.user!.userId);
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

// POST /api/teams — create a team
router.post("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name } = createTeamSchema.parse(req.body);
    const team = await teamService.createTeam(name, req.user!.userId);
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:teamId — get team with members
router.get("/:teamId", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const team = await teamService.getTeamById(
      req.params["teamId"]! as string,
      req.user!.userId,
    );
    res.json(team);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/teams/:teamId/members — update a member's role
router.patch(
  "/:teamId/members",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { userId, role } = updateRoleSchema.parse(req.body);
      const updated = await teamService.updateMemberRole(
        req.params["teamId"]! as string,
        userId,
        role,
        req.user!.userId,
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/teams/:teamId/members/:userId — remove a member
router.delete(
  "/:teamId/members/:userId",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await teamService.removeMember(
        req.params["teamId"]! as string,
        req.params["userId"]! as string,
        req.user!.userId,
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
