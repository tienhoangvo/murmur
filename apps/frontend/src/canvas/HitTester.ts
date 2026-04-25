import type { CanvasElement, ArrowElement } from "@murmur/shared";

export interface HitResult {
  element: CanvasElement;
  handle?: ResizeHandle;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "w" | "sw" | "s" | "se";

const HANDLE_SIZE = 8;
const ARROW_HIT_TOLERANCE = 6;

export class HitTester {
  // test a point against all elements, returns topmost hit
  hitTest(
    x: number,
    y: number,
    elements: CanvasElement[],
    zOrder: string[],
  ): HitResult | null {
    // iterate reverse z-order (topmost first)
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

  // test a point against resize handles of a selected element
  hitTestHandle(
    x: number,
    y: number,
    element: CanvasElement,
    scale: number,
  ): ResizeHandle | null {
    if (element.type === "arrow") return null;

    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;

    // transform mouse into element's local space
    if (element.rotation !== 0) {
      const cos = Math.cos(-element.rotation);
      const sin = Math.sin(-element.rotation);
      const dx = x - cx;
      const dy = y - cy;
      x = cx + dx * cos - dy * sin;
      y = cy + dx * sin + dy * cos;
    }

    const handles = this.getHandlePositions(element);
    const size = HANDLE_SIZE / scale;

    for (const [handle, pos] of Object.entries(handles)) {
      if (
        x >= pos.x - size / 2 &&
        x <= pos.x + size / 2 &&
        y >= pos.y - size / 2 &&
        y <= pos.y + size / 2
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
    if (element.type === "arrow") return false;

    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;

    // transform the mouse point into the element's local (unrotated) space
    if (element.rotation !== 0) {
      const cos = Math.cos(-element.rotation);
      const sin = Math.sin(-element.rotation);
      const dx = x - cx;
      const dy = y - cy;
      x = cx + dx * cos - dy * sin;
      y = cy + dx * sin + dy * cos;
    }

    // now hit test in local space
    const rotateX = element.x + element.width / 2;
    const rotateY = element.y - 24 / scale;
    const size = 8 / scale / 2 + 4 / scale;

    return Math.hypot(x - rotateX, y - rotateY) <= size;
  }

  // test all elements against a marquee rect
  hitTestMarquee(
    marqueeX: number,
    marqueeY: number,
    marqueeW: number,
    marqueeH: number,
    elements: CanvasElement[],
  ): string[] {
    return elements
      .filter((el) =>
        this.elementInMarquee(el, marqueeX, marqueeY, marqueeW, marqueeH),
      )
      .map((el) => el.id);
  }

  private pointInElement(x: number, y: number, el: CanvasElement): boolean {
    if (el.type === "arrow") {
      return this.pointNearArrow(x, y, el as ArrowElement);
    }

    // AABB test for all other element types
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

  private elementInMarquee(
    el: CanvasElement,
    mx: number,
    my: number,
    mw: number,
    mh: number,
  ): boolean {
    return (
      el.x < mx + mw &&
      el.x + el.width > mx &&
      el.y < my + mh &&
      el.y + el.height > my
    );
  }

  getHandlePositions(
    el: CanvasElement,
  ): Record<ResizeHandle, { x: number; y: number }> {
    const { x, y, width, height } = el;
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
