import type { Socket, Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Presence,
} from "@murmur/shared";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type MurmurSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// in-memory presence store: boardId -> userId -> Presence
const boardPresence = new Map<string, Map<string, Presence>>();

export function registerPresenceHandlers(io: IO, socket: MurmurSocket) {
  const userId = socket.data["userId"] as string;

  socket.on("board:join", async (boardId) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) return;

      if (!boardPresence.has(boardId)) {
        boardPresence.set(boardId, new Map());
      }

      const presence: Presence = {
        userId,
        name: user.name,
        avatarColor: user.avatarColor,
        cursor: null,
        activeTool: "select",
      };

      boardPresence.get(boardId)!.set(userId, presence);

      // send full presence state to the joining user
      const members = Array.from(boardPresence.get(boardId)!.values());
      socket.emit("presence:state", members);

      // notify others that this user joined
      socket.to(boardId).emit("presence:updated", presence);
    } catch (err) {
      console.error("presence board:join error", err);
    }
  });

  socket.on("presence:update", (data) => {
    // find which board this socket is in
    const boardId = getBoardIdForSocket(socket);
    if (!boardId) return;

    const existing = boardPresence.get(boardId)?.get(userId);
    if (!existing) return;

    const updated: Presence = { ...existing, ...data };
    boardPresence.get(boardId)!.set(userId, updated);

    // broadcast to others — presence updates are high frequency
    // so we only send to room, not back to sender
    socket.to(boardId).emit("presence:updated", updated);
  });

  socket.on("board:leave", (boardId) => {
    cleanupPresence(boardId, userId, socket, io);
  });

  socket.on("disconnect", () => {
    // clean up presence for all boards this socket was in
    for (const boardId of socket.rooms) {
      cleanupPresence(boardId, userId, socket, io);
    }
  });
}

function getBoardIdForSocket(socket: MurmurSocket): string | null {
  for (const room of socket.rooms) {
    if (room !== socket.id) return room;
  }
  return null;
}

function cleanupPresence(
  boardId: string,
  userId: string,
  socket: MurmurSocket,
  io: IO,
) {
  const board = boardPresence.get(boardId);
  if (!board) return;

  board.delete(userId);

  if (board.size === 0) {
    boardPresence.delete(boardId);
  }

  io.to(boardId).emit("presence:left", userId);
}
