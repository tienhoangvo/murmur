import type { CanvasElement, ArrowElement } from "@murmur/shared";

export interface HitResult {
  element: CanvasElement;
  handle?: ResizeHandle;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "w" | "sw" | "s" | "se";

const HANDLE_SIZE = 8;
const ARROW_HIT_TOLERANCE = 6;
const SELECTION_PAD = 8;

export class HitTester {
  private getElementBounds(el: CanvasElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (el.type === "arrow" || el.type === "freehand") {
      const xs = el.points.map((p) => p.x);
      const ys = el.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: Math.max(maxX - minX, 20),
        height: Math.max(maxY - minY, 20),
      };
    }
    return { x: el.x, y: el.y, width: el.width, height: el.height };
  }

  hitTest(
    x: number,
    y: number,
    elements: CanvasElement[],
    zOrder: string[],
  ): HitResult | null {
    for (let i = zOrder.length - 1; i >= 0; i--) {
      const id = zOrder[i];
      if (!id) continue;
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      if (this.pointInElement(x, y, el)) {
        return { element: el };
      }
    }
    return null;
  }

  hitTestHandle(
    x: number,
    y: number,
    element: CanvasElement,
    scale: number,
  ): ResizeHandle | null {
    const cos = Math.cos(-element.rotation);
    const sin = Math.sin(-element.rotation);

    let lx = x;
    let ly = y;

    if (
      element.rotation !== 0 &&
      element.type !== "arrow" &&
      element.type !== "freehand"
    ) {
      const bounds = this.getElementBounds(element);
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      lx = cx + dx * cos - dy * sin;
      ly = cy + dx * sin + dy * cos;
    }

    const handles = this.getHandlePositions(element, scale);
    const size = HANDLE_SIZE / scale;

    for (const [handle, pos] of Object.entries(handles)) {
      if (
        lx >= pos.x - size / 2 &&
        lx <= pos.x + size / 2 &&
        ly >= pos.y - size / 2 &&
        ly <= pos.y + size / 2
      ) {
        return handle as ResizeHandle;
      }
    }
    return null;
  }

  hitTestRotateHandle(
    x: number,
    y: number,
    element: CanvasElement,
    scale: number,
  ): boolean {
    if (element.type === "arrow" || element.type === "freehand") return false;

    const bounds = this.getElementBounds(element);
    const pad = SELECTION_PAD / scale;
    const bx = bounds.x - pad;
    const by = bounds.y - pad;
    const bw = bounds.width + pad * 2;

    if (element.rotation !== 0) {
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const cos = Math.cos(-element.rotation);
      const sin = Math.sin(-element.rotation);
      const dx = x - cx;
      const dy = y - cy;
      x = cx + dx * cos - dy * sin;
      y = cy + dx * sin + dy * cos;
    }

    const rotateX = bx + bw / 2;
    const rotateY = by - 24 / scale;
    const size = HANDLE_SIZE / scale / 2 + 4 / scale;

    return Math.hypot(x - rotateX, y - rotateY) <= size;
  }

  hitTestMarquee(
    mx: number,
    my: number,
    mw: number,
    mh: number,
    elements: CanvasElement[],
  ): string[] {
    return elements
      .filter((el) => {
        const b = this.getElementBounds(el);
        return (
          b.x < mx + mw &&
          b.x + b.width > mx &&
          b.y < my + mh &&
          b.y + b.height > my
        );
      })
      .map((el) => el.id);
  }

  private pointInElement(x: number, y: number, el: CanvasElement): boolean {
    if (el.type === "arrow") {
      return this.pointNearArrow(x, y, el as ArrowElement);
    }
    if (el.type === "freehand") {
      return this.pointNearFreehand(x, y, el);
    }

    // rotate point into element local space
    if (el.rotation !== 0) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const cos = Math.cos(-el.rotation);
      const sin = Math.sin(-el.rotation);
      const dx = x - cx;
      const dy = y - cy;
      x = cx + dx * cos - dy * sin;
      y = cy + dx * sin + dy * cos;
    }

    return (
      x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height
    );
  }

  private pointNearArrow(x: number, y: number, el: ArrowElement): boolean {
    const points = el.points;
    if (points.length < 2) return false;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      if (this.distToSegment(x, y, a.x, a.y, b.x, b.y) < ARROW_HIT_TOLERANCE) {
        return true;
      }
    }
    return false;
  }

  private pointNearFreehand(
    x: number,
    y: number,
    el: CanvasElement & { points: { x: number; y: number }[] },
  ): boolean {
    const points = el.points;
    if (points.length < 2) return false;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      if (this.distToSegment(x, y, a.x, a.y, b.x, b.y) < ARROW_HIT_TOLERANCE) {
        return true;
      }
    }
    return false;
  }

  private distToSegment(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  getHandlePositions(
    el: CanvasElement,
    scale: number = 1,
  ): Record<ResizeHandle, { x: number; y: number }> {
    const bounds = this.getElementBounds(el);
    const pad = (el.type === "text" ? 4 : SELECTION_PAD) / scale;
    const x = bounds.x - pad;
    const y = bounds.y - pad;
    const width = bounds.width + pad * 2;
    const height = bounds.height + pad * 2;
    const cx = x + width / 2;
    const cy = y + height / 2;

    return {
      nw: { x, y },
      n: { x: cx, y },
      ne: { x: x + width, y },
      e: { x: x + width, y: cy },
      se: { x: x + width, y: y + height },
      s: { x: cx, y: y + height },
      sw: { x, y: y + height },
      w: { x, y: cy },
    };
  }
}
