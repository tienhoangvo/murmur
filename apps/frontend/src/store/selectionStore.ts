import { create } from "zustand";
import type { Point } from "@murmur/shared";

type Tool =
  | "select"
  | "rect"
  | "square"
  | "ellipse"
  | "circle"
  | "cloud"
  | "arrow"
  | "text"
  | "freehand";

interface SelectionState {
  selectedIds: Set<string>;
  activeTool: Tool;
  isMarqueeSelecting: boolean;
  marqueeStart: Point | null;
  marqueeEnd: Point | null;

  // actions
  select: (id: string) => void;
  selectMany: (ids: string[]) => void;
  deselect: (id: string) => void;
  deselectAll: () => void;
  toggleSelect: (id: string) => void;
  setActiveTool: (tool: Tool) => void;
  startMarquee: (point: Point) => void;
  updateMarquee: (point: Point) => void;
  endMarquee: () => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: new Set(),
  activeTool: "select",
  isMarqueeSelecting: false,
  marqueeStart: null,
  marqueeEnd: null,

  select: (id) =>
    set(() => ({
      selectedIds: new Set([id]),
    })),

  selectMany: (ids) =>
    set(() => ({
      selectedIds: new Set(ids),
    })),

  deselect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.delete(id);
      return { selectedIds: next };
    }),

  deselectAll: () =>
    set(() => ({
      selectedIds: new Set(),
    })),

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  setActiveTool: (tool) =>
    set(() => ({
      activeTool: tool,
      selectedIds: new Set(),
    })),

  startMarquee: (point) =>
    set(() => ({
      isMarqueeSelecting: true,
      marqueeStart: point,
      marqueeEnd: point,
    })),

  updateMarquee: (point) =>
    set(() => ({
      marqueeEnd: point,
    })),

  endMarquee: () =>
    set(() => ({
      isMarqueeSelecting: false,
      marqueeStart: null,
      marqueeEnd: null,
    })),
}));

// helpers
export function getMarqueeBounds(
  start: Point,
  end: Point,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export const getSelectionState = () => useSelectionStore.getState();
