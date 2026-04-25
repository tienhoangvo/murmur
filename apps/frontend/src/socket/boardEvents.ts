import { getSocket } from "./socketClient";
import { useBoardStore } from "../store/boardStore";
import { usePresenceStore } from "../store/presenceStore";
import type { CanvasElement, ElementUpdate } from "@murmur/shared";

export function joinBoard(boardId: string): Promise<CanvasElement[]> {
  return new Promise((resolve) => {
    const socket = getSocket();
    socket.emit("board:join", boardId, (snapshot) => {
      useBoardStore.getState().loadSnapshot(snapshot);
      resolve(snapshot);
    });
  });
}

export function leaveBoard(boardId: string) {
  const socket = getSocket();
  socket.emit("board:leave", boardId);
  useBoardStore.getState().reset();
  usePresenceStore.getState().reset();
}

export function emitCreateElement(element: CanvasElement) {
  getSocket().emit("element:create", element);
}

export function emitUpdateElement(update: ElementUpdate) {
  getSocket().emit("element:update", update);
}

export function emitDeleteElement(elementId: string) {
  getSocket().emit("element:delete", elementId);
}

export function emitReorderElement(elementId: string, zIndex: number) {
  getSocket().emit("element:reorder", elementId, zIndex);
}

export function emitPresenceUpdate(data: {
  cursor: { x: number; y: number } | null;
  activeTool: string;
}) {
  getSocket().emit("presence:update", data);
}

// ── Incoming event listeners ──────────────────────────────────────────────────

export function registerBoardListeners() {
  const socket = getSocket();
  const board = useBoardStore.getState();
  const presence = usePresenceStore.getState();

  socket.on("element:created", (element) => {
    board.addElement(element);
  });

  socket.on("element:updated", (update) => {
    board.updateElement(update);
  });

  socket.on("element:deleted", (elementId) => {
    board.removeElement(elementId);
  });

  socket.on("element:reordered", (elementId, zIndex) => {
    board.reorderElement(elementId, zIndex);
  });

  socket.on("presence:state", (members) => {
    presence.setAllMembers(members);
  });

  socket.on("presence:updated", (data) => {
    presence.updateMember(data);
  });

  socket.on("presence:left", (userId) => {
    presence.removeMember(userId);
  });
}

export function unregisterBoardListeners() {
  const socket = getSocket();
  socket.off("element:created");
  socket.off("element:updated");
  socket.off("element:deleted");
  socket.off("element:reordered");
  socket.off("presence:state");
  socket.off("presence:updated");
  socket.off("presence:left");
}
