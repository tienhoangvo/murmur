import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CanvasElement, ElementUpdate } from "@murmur/shared";

interface BoardState {
  boardId: string | null;
  elements: Record<string, CanvasElement>;
  zOrder: string[];
  isDirty: boolean;

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
    elements: {},
    zOrder: [],
    isDirty: false,

    setBoard: (boardId) =>
      set((state) => {
        state.boardId = boardId;
      }),

    loadSnapshot: (snapshot) =>
      set((state) => {
        state.elements = Object.fromEntries(snapshot.map((el) => [el.id, el]));
        state.zOrder = [...snapshot]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((el) => el.id);
        state.isDirty = false;
      }),

    addElement: (element) =>
      set((state) => {
        state.elements[element.id] = element;
        state.zOrder.push(element.id);
        state.isDirty = true;
      }),

    updateElement: (update) =>
      set((state) => {
        const existing = state.elements[update.id];
        if (!existing) return;
        state.elements[update.id] = { ...existing, ...update } as CanvasElement;
        state.isDirty = true;
      }),

    removeElement: (id) =>
      set((state) => {
        delete state.elements[id];
        state.zOrder = state.zOrder.filter((zId: string) => zId !== id);
        state.isDirty = true;
      }),

    reorderElement: (id, zIndex) =>
      set((state) => {
        const el = state.elements[id];
        if (!el) return;
        state.elements[id] = { ...el, zIndex } as CanvasElement;
        state.zOrder = Object.values(state.elements)
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
        state.elements = {};
        state.zOrder = [];
        state.isDirty = false;
      }),
  })),
);

export const getBoardState = () => useBoardStore.getState();
