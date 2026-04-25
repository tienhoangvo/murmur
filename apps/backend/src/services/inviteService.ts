import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { invites, teamMemberships, users } from "../db/schema.js";
import { AppError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import { randomUUID } from "crypto";
import { randomBytes } from "crypto";
import type { Role } from "@murmur/shared";

export async function createInvite(
  teamId: string,
  email: string,
  role: Role,
  invitedBy: string,
) {
  // check inviter has owner/editor role
  const [membership] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, invitedBy),
      ),
    )
    .limit(1);

  if (!membership) throw new ForbiddenError("Not a team member");
  if (membership.role === "viewer") {
    throw new ForbiddenError("Viewers cannot invite members");
  }
  // only owners can invite owners
  if (role === "owner" && membership.role !== "owner") {
    throw new ForbiddenError("Only owners can invite owners");
  }

  // check if already a member
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUser[0]) {
    const existingMembership = await db
      .select()
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.userId, existingUser[0].id),
        ),
      )
      .limit(1);

    if (existingMembership[0]) {
      throw new AppError(
        "User is already a team member",
        409,
        "ALREADY_MEMBER",
      );
    }
  }

  // revoke any existing pending invite for this email+team
  await db
    .delete(invites)
    .where(
      and(eq(invites.teamId, teamId), eq(invites.email, email.toLowerCase())),
    );

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [invite] = await db
    .insert(invites)
    .values({
      id: randomUUID(),
      teamId,
      email: email.toLowerCase(),
      role,
      token,
      invitedBy,
      expiresAt,
    })
    .returning();

  if (!invite) throw new AppError("Failed to create invite", 500);

  return invite;
}

export async function acceptInvite(token: string, userId: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite) throw new NotFoundError("Invite");
  if (invite.acceptedAt) throw new AppError("Invite already accepted", 400);
  if (invite.expiresAt < new Date()) {
    throw new AppError("Invite has expired", 400, "INVITE_EXPIRED");
  }

  // verify the accepting user's email matches
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new NotFoundError("User");
  if (user.email !== invite.email) {
    throw new ForbiddenError(
      "This invite was sent to a different email address",
    );
  }

  // add to team
  await db.insert(teamMemberships).values({
    id: randomUUID(),
    teamId: invite.teamId,
    userId,
    role: invite.role,
  });

  // mark accepted
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));

  return { teamId: invite.teamId, role: invite.role };
}

export async function getTeamInvites(teamId: string, requestingUserId: string) {
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
  if (membership.role === "viewer")
    throw new ForbiddenError("Viewers cannot view invites");

  return db.select().from(invites).where(eq(invites.teamId, teamId));
}

export async function revokeInvite(inviteId: string, requestingUserId: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1);

  if (!invite) throw new NotFoundError("Invite");

  const [membership] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, invite.teamId),
        eq(teamMemberships.userId, requestingUserId),
      ),
    )
    .limit(1);

  if (!membership || membership.role === "viewer") {
    throw new ForbiddenError("Insufficient permissions");
  }

  await db.delete(invites).where(eq(invites.id, inviteId));
}
