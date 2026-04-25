import type { Viewport } from "./Viewport";
import type { HitTester } from "./HitTester";
import { getBoardState } from "../store/boardStore";
import { getSelectionState } from "../store/selectionStore";
import { useSelectionStore } from "../store/selectionStore";
import { useViewportStore } from "../store/viewportStore";
import { emitUpdateElement, emitPresenceUpdate } from "../socket/boardEvents";

type Tool = "select" | "sticky_note" | "text_box" | "shape" | "arrow" | "image";

interface DragState {
  isDragging: boolean;
  startWorldX: number;
  startWorldY: number;
  startScreenX: number;
  startScreenY: number;
  elementStartPositions: Map<string, { x: number; y: number }>;
}

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private viewport: Viewport;
  private hitTester: HitTester;
  private onDirty: () => void;

  private drag: DragState = {
    isDragging: false,
    startWorldX: 0,
    startWorldY: 0,
    startScreenX: 0,
    startScreenY: 0,
    elementStartPositions: new Map(),
  };

  private isPanning = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private presenceThrottle = 0;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    hitTester: HitTester,
    onDirty: () => void,
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.hitTester = hitTester;
    this.onDirty = onDirty;
    this.attach();
  }

  private attach() {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("mouseleave", this.onMouseLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this.onDblClick);
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("dblclick", this.onDblClick);
  }

  private onMouseDown = (e: MouseEvent) => {
    const tool = getSelectionState().activeTool as Tool;
    const worldPos = this.viewport.eventToWorld(e);
    const screenPos = this.viewport.eventToScreen(e);
    const { elements, zOrder } = getBoardState();
    const elementsArray = Array.from(elements.values());

    // middle mouse or space+drag = pan
    if (e.button === 1 || (e.button === 0 && tool === "select" && e.altKey)) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (tool === "select") {
      // check resize handles first
      const { selectedIds } = getSelectionState();
      if (selectedIds.size === 1) {
        const selectedId = Array.from(selectedIds)[0]!;
        const el = elements.get(selectedId);
        if (el) {
          const handle = this.hitTester.hitTestHandle(
            worldPos.x,
            worldPos.y,
            el,
            this.viewport.state.scale,
          );
          if (handle) {
            // TODO: resize logic
            return;
          }
        }
      }

      const hit = this.hitTester.hitTest(
        worldPos.x,
        worldPos.y,
        elementsArray,
        zOrder,
      );

      if (hit) {
        if (e.shiftKey) {
          useSelectionStore.getState().toggleSelect(hit.element.id);
        } else if (!getSelectionState().selectedIds.has(hit.element.id)) {
          useSelectionStore.getState().select(hit.element.id);
        }

        // start drag
        this.drag.isDragging = true;
        this.drag.startWorldX = worldPos.x;
        this.drag.startWorldY = worldPos.y;
        this.drag.startScreenX = screenPos.x;
        this.drag.startScreenY = screenPos.y;
        this.drag.elementStartPositions = new Map(
          Array.from(getSelectionState().selectedIds).map((id) => {
            const el = elements.get(id)!;
            return [id, { x: el.x, y: el.y }];
          }),
        );
      } else {
        // start marquee
        if (!e.shiftKey) useSelectionStore.getState().deselectAll();
        useSelectionStore.getState().startMarquee(worldPos);
      }
    }

    this.onDirty();
  };

  private onMouseMove = (e: MouseEvent) => {
    const worldPos = this.viewport.eventToWorld(e);

    // pan
    if (this.isPanning) {
      const dx = e.clientX - this.lastPanX;
      const dy = e.clientY - this.lastPanY;
      useViewportStore.getState().pan(dx, dy);
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.onDirty();
      return;
    }

    // drag elements
    if (this.drag.isDragging) {
      const dx = worldPos.x - this.drag.startWorldX;
      const dy = worldPos.y - this.drag.startWorldY;

      const { elements } = getBoardState();

      for (const [id, startPos] of this.drag.elementStartPositions) {
        const el = elements.get(id);
        if (!el) continue;
        const newX = startPos.x + dx;
        const newY = startPos.y + dy;
        getBoardState().updateElement({ id, x: newX, y: newY });
      }

      this.onDirty();
      return;
    }

    // marquee
    const { isMarqueeSelecting } = getSelectionState();
    if (isMarqueeSelecting) {
      useSelectionStore.getState().updateMarquee(worldPos);

      const { marqueeStart, marqueeEnd } = getSelectionState();
      if (marqueeStart && marqueeEnd) {
        const { elements } = getBoardState();
        const minX = Math.min(marqueeStart.x, marqueeEnd.x);
        const minY = Math.min(marqueeStart.y, marqueeEnd.y);
        const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
        const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
        const ids = this.hitTester.hitTestMarquee(
          minX,
          minY,
          maxX - minX,
          maxY - minY,
          Array.from(elements.values()),
        );
        useSelectionStore.getState().selectMany(ids);
      }

      this.onDirty();
    }

    // throttled presence update
    const now = Date.now();
    if (now - this.presenceThrottle > 16) {
      this.presenceThrottle = now;
      emitPresenceUpdate({
        cursor: worldPos,
        activeTool: getSelectionState().activeTool,
      });
    }
  };

  private onMouseUp = () => {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
      return;
    }

    // emit final positions on mouseup
    if (this.drag.isDragging) {
      const { elements } = getBoardState();
      for (const id of this.drag.elementStartPositions.keys()) {
        const el = elements.get(id);
        if (!el) continue;
        emitUpdateElement({ id, x: el.x, y: el.y });
      }
    }

    this.drag.isDragging = false;
    this.drag.elementStartPositions.clear();

    const { isMarqueeSelecting } = getSelectionState();
    if (isMarqueeSelecting) {
      useSelectionStore.getState().endMarquee();
    }

    this.onDirty();
  };

  private onMouseLeave = () => {
    this.isPanning = false;
    this.drag.isDragging = false;
    emitPresenceUpdate({
      cursor: null,
      activeTool: getSelectionState().activeTool,
    });
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const screenPos = this.viewport.eventToScreen(e);
      this.viewport.zoom(e.deltaY, screenPos.x, screenPos.y);
    } else {
      useViewportStore.getState().pan(-e.deltaX, -e.deltaY);
    }

    this.onDirty();
  };

  private onDblClick = () => {
    // TODO: open text editor for sticky notes / text boxes
  };

  updateCursor() {
    const tool = getSelectionState().activeTool as Tool;
    const cursors: Record<Tool, string> = {
      select: "default",
      sticky_note: "crosshair",
      text_box: "text",
      shape: "crosshair",
      arrow: "crosshair",
      image: "crosshair",
    };
    this.canvas.style.cursor = cursors[tool];
  }
}
