import {
  useViewportStore,
  screenToWorld,
  type ViewportState,
} from "../store/viewportStore";

export class Viewport {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get state(): ViewportState {
    return useViewportStore.getState();
  }

  // apply transform to ctx before drawing
  applyTransform(ctx: CanvasRenderingContext2D) {
    const { x, y, scale } = this.state;
    ctx.setTransform(scale, 0, 0, scale, x, y);
  }

  resetTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // convert mouse event position to world coords
  eventToWorld(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return screenToWorld(screenX, screenY, this.state);
  }

  eventToScreen(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  pan(dx: number, dy: number) {
    useViewportStore.getState().pan(dx, dy);
  }

  zoom(delta: number, originX: number, originY: number) {
    const { scale } = this.state;
    const factor = delta > 0 ? 0.9 : 1.1;
    useViewportStore.getState().zoom(scale * factor, originX, originY);
  }

  zoomTo(newScale: number, originX: number, originY: number) {
    useViewportStore.getState().zoom(newScale, originX, originY);
  }

  reset() {
    useViewportStore.getState().reset();
  }

  // get visible world bounds — useful for culling off-screen elements
  getWorldBounds(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const { x, y, scale } = this.state;
    const w = this.canvas.width / window.devicePixelRatio;
    const h = this.canvas.height / window.devicePixelRatio;
    return {
      left: -x / scale,
      top: -y / scale,
      right: (-x + w) / scale,
      bottom: (-y + h) / scale,
    };
  }
}
