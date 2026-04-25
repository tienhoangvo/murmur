import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@murmur/shared";
import type { Server as HttpServer } from "http";
import { wsAuthMiddleware } from "../middleware/wsAuth.js";
import { registerBoardHandlers } from "./boardHandlers.js";
import { registerPresenceHandlers } from "./presenceHandlers.js";

export function initSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: process.env.CLIENT_URL,
        credentials: true,
      },
    },
  );

  io.use(wsAuthMiddleware);

  io.on("connection", (socket) => {
    console.log(
      `socket connected: ${socket.id} user: ${socket.data["userId"]}`,
    );

    registerBoardHandlers(io, socket);
    registerPresenceHandlers(io, socket);

    socket.on("disconnect", () => {
      console.log(`socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
