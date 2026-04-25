import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@murmur/shared";
import { verifyAccessToken } from "../lib/jwt.js";

type MurmurSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function wsAuthMiddleware(
  socket: MurmurSocket,
  next: (err?: Error) => void,
) {
  try {
    const token =
      (socket.handshake.auth["token"] as string | undefined) ??
      socket.handshake.headers["authorization"]?.toString().slice(7);

    if (!token) {
      return next(new Error("UNAUTHORIZED"));
    }

    const payload = verifyAccessToken(token);
    socket.data["userId"] = payload.userId;
    socket.data["email"] = payload.email;
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
}
