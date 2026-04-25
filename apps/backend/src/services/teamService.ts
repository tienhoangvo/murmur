import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { teams, teamMemberships, users } from "../db/schema.js";
import { AppError, NotFoundError, ForbiddenError } from "../lib/errors.js";
import { randomUUID } from "crypto";
import type { Role } from "@murmur/shared";

export async function createTeam(name: string, ownerId: string) {
  const teamId = randomUUID();

  const [team] = await db
    .insert(teams)
    .values({ id: teamId, name, createdBy: ownerId })
    .returning();

  if (!team) throw new AppError("Failed to create team", 500);

  // creator becomes owner
  await db.insert(teamMemberships).values({
    id: randomUUID(),
    teamId,
    userId: ownerId,
    role: "owner",
  });

  return team;
}

export async function getTeamsForUser(userId: string) {
  const memberships = await db
    .select({
      team: teams,
      role: teamMemberships.role,
    })
    .from(teamMemberships)
    .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
    .where(eq(teamMemberships.userId, userId));

  return memberships;
}

export async function getTeamById(teamId: string, requestingUserId: string) {
  const [membership] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, requestingUserId),
      ),
    )
    .limit(1);

  if (!membership) throw new ForbiddenError("Not a team member");

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) throw new NotFoundError("Team");

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
      role: teamMemberships.role,
    })
    .from(teamMemberships)
    .innerJoin(users, eq(teamMemberships.userId, users.id))
    .where(eq(teamMemberships.teamId, teamId));

  return { ...team, members };
}

export async function updateMemberRole(
  teamId: string,
  targetUserId: string,
  newRole: Role,
  requestingUserId: string,
) {
  // only owners can change roles
  const [requester] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, requestingUserId),
      ),
    )
    .limit(1);

  if (!requester || requester.role !== "owner") {
    throw new ForbiddenError("Only owners can change roles");
  }

  // prevent owner demoting themselves
  if (targetUserId === requestingUserId) {
    throw new AppError("Cannot change your own role", 400);
  }

  const [updated] = await db
    .update(teamMemberships)
    .set({ role: newRole })
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, targetUserId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError("Team member");

  return updated;
}

export async function removeMember(
  teamId: string,
  targetUserId: string,
  requestingUserId: string,
) {
  const [requester] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, requestingUserId),
      ),
    )
    .limit(1);

  if (!requester || requester.role !== "owner") {
    throw new ForbiddenError("Only owners can remove members");
  }

  if (targetUserId === requestingUserId) {
    throw new AppError("Cannot remove yourself", 400);
  }

  await db
    .delete(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, targetUserId),
      ),
    );
}
