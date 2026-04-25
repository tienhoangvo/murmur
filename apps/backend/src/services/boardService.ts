import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { boards, elements, teamMemberships } from "../db/schema.js";
import { AppError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import { randomUUID } from "crypto";
import type { CanvasElement } from "@murmur/shared";

export async function createBoard(
  teamId: string,
  name: string,
  userId: string,
) {
  const [membership] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) throw new ForbiddenError("Not a team member");
  if (membership.role === "viewer")
    throw new ForbiddenError("Viewers cannot create boards");

  const [board] = await db
    .insert(boards)
    .values({ id: randomUUID(), teamId, name, createdBy: userId })
    .returning();

  if (!board) throw new AppError("Failed to create board", 500);

  return board;
}

export async function getBoardsForTeam(teamId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) throw new ForbiddenError("Not a team member");

  return db.select().from(boards).where(eq(boards.teamId, teamId));
}

export async function getBoardById(boardId: string, userId: string) {
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!board) throw new NotFoundError("Board");

  const [membership] = await db
    .select()
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.teamId, board.teamId),
        eq(teamMemberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) throw new ForbiddenError("Not a team member");

  return { board, role: membership.role };
}

export async function getBoardSnapshot(
  boardId: string,
  userId: string,
): Promise<CanvasElement[]> {
  await getBoardById(boardId, userId); // access check

  const rows = await db
    .select()
    .from(elements)
    .where(eq(elements.boardId, boardId));

  return rows.map((row) => ({
    id: row.id,
    boardId: row.boardId,
    createdBy: row.createdBy,
    type: row.type,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    zIndex: row.zIndex,
    locked: row.locked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.data as object),
  })) as CanvasElement[];
}

export async function deleteBoard(boardId: string, userId: string) {
  const { role } = await getBoardById(boardId, userId);

  if (role === "viewer")
    throw new ForbiddenError("Viewers cannot delete boards");

  await db.delete(boards).where(eq(boards.id, boardId));
}
