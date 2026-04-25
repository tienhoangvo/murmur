import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@murmur/shared";
import type { Server as HttpServer } from "http";
import { wsAuthMiddleware } from "../middleware/wsAuth.js";

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

    socket.on("disconnect", () => {
      console.log(`socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
