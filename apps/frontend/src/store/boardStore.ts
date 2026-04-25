import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CanvasElement, ElementUpdate } from "@murmur/shared";

interface BoardState {
  boardId: string | null;
  elements: Map<string, CanvasElement>;
  zOrder: string[];
  isDirty: boolean;

  // actions
  setBoard: (boardId: string) => void;
  loadSnapshot: (elements: CanvasElement[]) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (update: ElementUpdate) => void;
  removeElement: (id: string) => void;
  reorderElement: (id: string, zIndex: number) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
}

export const useBoardStore = create<BoardState>()(
  immer((set) => ({
    boardId: null,
    elements: new Map(),
    zOrder: [],
    isDirty: false,

    setBoard: (boardId) =>
      set((state) => {
        state.boardId = boardId;
      }),

    loadSnapshot: (snapshot) =>
      set((state) => {
        state.elements = new Map(snapshot.map((el) => [el.id, el]));
        state.zOrder = [...snapshot]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((el) => el.id);
        state.isDirty = false;
      }),

    addElement: (element) =>
      set((state) => {
        state.elements.set(element.id, element);
        state.zOrder.push(element.id);
        state.isDirty = true;
      }),

    updateElement: (update) =>
      set((state) => {
        const existing = state.elements.get(update.id);
        if (!existing) return;
        state.elements.set(update.id, {
          ...existing,
          ...update,
        } as CanvasElement);
        state.isDirty = true;
      }),

    removeElement: (id) =>
      set((state) => {
        state.elements.delete(id);
        state.zOrder = state.zOrder.filter((zId: string) => zId !== id);
        state.isDirty = true;
      }),

    reorderElement: (id, zIndex) =>
      set((state) => {
        const el = state.elements.get(id);
        if (!el) return;
        state.elements.set(id, { ...el, zIndex } as CanvasElement);
        state.zOrder = [...state.elements.values()]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((el) => el.id);
        state.isDirty = true;
      }),

    markDirty: () =>
      set((state) => {
        state.isDirty = true;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),

    reset: () =>
      set((state) => {
        state.boardId = null;
        state.elements = new Map();
        state.zOrder = [];
        state.isDirty = false;
      }),
  })),
);

// selector for canvas engine — reads outside React
export const getBoardState = () => useBoardStore.getState();
