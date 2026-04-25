import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import { db } from "../db/client.js";
import { teamMemberships } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { Role } from "@murmur/shared";

const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export function requireRole(minimum: Role) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new UnauthorizedError();

      const teamId = req.params["teamId"] ?? req.body?.teamId;
      if (!teamId) throw new ForbiddenError("Team context required");

      const [membership] = await db
        .select()
        .from(teamMemberships)
        .where(
          and(
            eq(teamMemberships.teamId, teamId as string),
            eq(teamMemberships.userId, req.user.userId as string),
          ),
        )
        .limit(1);

      if (!membership) throw new ForbiddenError("Not a team member");

      if (ROLE_RANK[membership.role] < ROLE_RANK[minimum]) {
        throw new ForbiddenError("Insufficient permissions");
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
