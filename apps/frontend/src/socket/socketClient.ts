import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@murmur/shared";
import { tokenStorage } from "../api/client";

type MurmurSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: MurmurSocket | null = null;

export function getSocket(): MurmurSocket {
  if (!socket) {
    socket = io(import.meta.env.VITE_WS_URL ?? "http://localhost:3001", {
      autoConnect: false,
      auth: (cb) => {
        cb({ token: tokenStorage.getAccess() });
      },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
