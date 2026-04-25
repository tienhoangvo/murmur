import type { Socket, Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  CanvasElement,
  ElementUpdate,
} from "@murmur/shared";
import { db } from "../db/client.js";
import { elements, boards, teamMemberships } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type MurmurSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

async function getUserBoardRole(boardId: string, userId: string) {
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!board) return null;

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

  return membership?.role ?? null;
}

export function registerBoardHandlers(io: IO, socket: MurmurSocket) {
  const userId = socket.data["userId"] as string;

  socket.on("board:join", async (boardId, callback) => {
    try {
      const role = await getUserBoardRole(boardId, userId);
      if (!role) {
        socket.emit("presence:left", userId);
        return;
      }

      await socket.join(boardId);

      // send full snapshot to joining user
      const rows = await db
        .select()
        .from(elements)
        .where(eq(elements.boardId, boardId));

      const snapshot: CanvasElement[] = rows.map((row) => ({
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

      callback(snapshot);
    } catch (err) {
      console.error("board:join error", err);
      callback([]);
    }
  });

  socket.on("board:leave", (boardId) => {
    socket.leave(boardId);
  });

  socket.on("element:create", async (element) => {
    try {
      const role = await getUserBoardRole(element.boardId, userId);
      if (!role || role === "viewer") return;

      const {
        id,
        boardId,
        type,
        x,
        y,
        width,
        height,
        rotation,
        zIndex,
        locked,
        createdBy,
        createdAt,
        updatedAt,
        ...data
      } = element;

      await db.insert(elements).values({
        id: id ?? randomUUID(),
        boardId,
        createdBy: userId,
        type,
        x,
        y,
        width,
        height,
        rotation,
        zIndex,
        locked,
        data,
      });

      // broadcast to everyone else in the room
      socket.to(element.boardId).emit("element:created", element);
    } catch (err) {
      console.error("element:create error", err);
    }
  });

  socket.on("element:update", async (update: ElementUpdate) => {
    try {
      const [existing] = await db
        .select()
        .from(elements)
        .where(eq(elements.id, update.id))
        .limit(1);

      if (!existing) return;

      const role = await getUserBoardRole(existing.boardId, userId);
      if (!role || role === "viewer") return;

      const { id, ...rest } = update;
      const { x, y, width, height, rotation, zIndex, locked, ...data } =
        rest as any;

      await db
        .update(elements)
        .set({
          ...(x !== undefined && { x }),
          ...(y !== undefined && { y }),
          ...(width !== undefined && { width }),
          ...(height !== undefined && { height }),
          ...(rotation !== undefined && { rotation }),
          ...(zIndex !== undefined && { zIndex }),
          ...(locked !== undefined && { locked }),
          ...(Object.keys(data).length > 0 && {
            data: { ...(existing.data as object), ...data },
          }),
          updatedAt: new Date(),
        })
        .where(eq(elements.id, id));

      socket.to(existing.boardId).emit("element:updated", update);
    } catch (err) {
      console.error("element:update error", err);
    }
  });

  socket.on("element:delete", async (elementId) => {
    try {
      const [existing] = await db
        .select()
        .from(elements)
        .where(eq(elements.id, elementId))
        .limit(1);

      if (!existing) return;

      const role = await getUserBoardRole(existing.boardId, userId);
      if (!role || role === "viewer") return;

      await db.delete(elements).where(eq(elements.id, elementId));

      socket.to(existing.boardId).emit("element:deleted", elementId);
    } catch (err) {
      console.error("element:delete error", err);
    }
  });

  socket.on("element:reorder", async (elementId, zIndex) => {
    try {
      const [existing] = await db
        .select()
        .from(elements)
        .where(eq(elements.id, elementId))
        .limit(1);

      if (!existing) return;

      const role = await getUserBoardRole(existing.boardId, userId);
      if (!role || role === "viewer") return;

      await db
        .update(elements)
        .set({ zIndex, updatedAt: new Date() })
        .where(eq(elements.id, elementId));

      socket.to(existing.boardId).emit("element:reordered", elementId, zIndex);
    } catch (err) {
      console.error("element:reorder error", err);
    }
  });
}
