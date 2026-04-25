import type { Viewport } from "./Viewport";
import type { HitTester } from "./HitTester";
import { getBoardState } from "../store/boardStore";
import { getSelectionState, useSelectionStore } from "../store/selectionStore";
import { useViewportStore } from "../store/viewportStore";
import {
  emitUpdateElement,
  emitPresenceUpdate,
  emitCreateElement,
} from "../socket/boardEvents";
import { createElement } from "./ElementFactory";
import type { CanvasElement } from "@murmur/shared";

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
  private boardId: string;
  private userId: string;

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
    boardId: string,
    userId: string,
    private onDblClickElement?: (element: CanvasElement) => void,
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.hitTester = hitTester;
    this.onDirty = onDirty;
    this.boardId = boardId;
    this.userId = userId;
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

    // middle mouse = pan
    if (e.button === 1) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    // space + drag = pan
    if (e.button === 0 && tool === "select" && e.altKey) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    // tool-based element creation
    if (tool !== "select" && tool !== "image") {
      const element = createElement(
        tool,
        worldPos.x,
        worldPos.y,
        this.boardId,
        this.userId,
      );
      getBoardState().addElement(element);
      emitCreateElement(element);
      useSelectionStore.getState().select(element.id);
      useSelectionStore.getState().setActiveTool("select");
      this.onDirty();
      return;
    }

    if (tool === "select") {
      const elementsArray = Object.values(elements);

      // check resize handles
      const { selectedIds } = getSelectionState();
      if (selectedIds.size === 1) {
        const selectedId = Array.from(selectedIds)[0]!;
        const el = elements[selectedId];
        if (el) {
          const handle = this.hitTester.hitTestHandle(
            worldPos.x,
            worldPos.y,
            el,
            this.viewport.state.scale,
          );
          if (handle) return;
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
            const el = elements[id]!;
            return [id, { x: el.x, y: el.y }];
          }),
        );
      } else {
        if (!e.shiftKey) useSelectionStore.getState().deselectAll();
        useSelectionStore.getState().startMarquee(worldPos);
      }
    }

    this.onDirty();
  };

  private onMouseMove = (e: MouseEvent) => {
    const worldPos = this.viewport.eventToWorld(e);

    if (this.isPanning) {
      const dx = e.clientX - this.lastPanX;
      const dy = e.clientY - this.lastPanY;
      useViewportStore.getState().pan(dx, dy);
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.onDirty();
      return;
    }

    if (this.drag.isDragging) {
      const dx = worldPos.x - this.drag.startWorldX;
      const dy = worldPos.y - this.drag.startWorldY;
      const { elements } = getBoardState();

      for (const [id, startPos] of this.drag.elementStartPositions) {
        const el = elements[id];
        if (!el) continue;
        getBoardState().updateElement({
          id,
          x: startPos.x + dx,
          y: startPos.y + dy,
        });
      }

      this.onDirty();
      return;
    }

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
          Object.values(elements),
        );
        useSelectionStore.getState().selectMany(ids);
      }
      this.onDirty();
    }

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

    if (this.drag.isDragging) {
      const { elements } = getBoardState();
      for (const id of this.drag.elementStartPositions.keys()) {
        const el = elements[id];
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

  private onDblClick = (e: MouseEvent) => {
    const worldPos = this.viewport.eventToWorld(e);
    const { elements, zOrder } = getBoardState();
    const hit = this.hitTester.hitTest(
      worldPos.x,
      worldPos.y,
      Object.values(elements),
      zOrder,
    );
    if (hit && this.onDblClickElement) {
      this.onDblClickElement(hit.element);
    }
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
