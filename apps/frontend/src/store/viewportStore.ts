import { create } from "zustand";

export interface ViewportState {
  x: number;
  y: number;
  scale: number;

  // actions
  pan: (dx: number, dy: number) => void;
  zoom: (newScale: number, originX: number, originY: number) => void;
  reset: () => void;
  setViewport: (x: number, y: number, scale: number) => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

export const useViewportStore = create<ViewportState>()((set, get) => ({
  x: 0,
  y: 0,
  scale: 1,

  pan: (dx, dy) =>
    set((state) => ({
      x: state.x + dx,
      y: state.y + dy,
    })),

  zoom: (newScale, originX, originY) => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    const { x, y, scale: oldScale } = get();

    // zoom toward the origin point (mouse position)
    const factor = scale / oldScale;
    set({
      scale,
      x: originX - (originX - x) * factor,
      y: originY - (originY - y) * factor,
    });
  },

  reset: () => set({ x: 0, y: 0, scale: 1 }),

  setViewport: (x, y, scale) => set({ x, y, scale }),
}));

// for canvas engine use outside React
export const getViewportState = () => useViewportStore.getState();

// convert screen coords to world coords
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: { x: number; y: number; scale: number },
): { x: number; y: number } {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
}

// convert world coords to screen coords
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: { x: number; y: number; scale: number },
): { x: number; y: number } {
  return {
    x: worldX * viewport.scale + viewport.x,
    y: worldY * viewport.scale + viewport.y,
  };
}
