import type { Viewport } from "./Viewport";
import type { HitTester, ResizeHandle } from "./HitTester";
import { getBoardState } from "../store/boardStore";
import { getSelectionState, useSelectionStore } from "../store/selectionStore";
import { useViewportStore } from "../store/viewportStore";
import {
  emitUpdateElement,
  emitPresenceUpdate,
  emitCreateElement,
} from "../socket/boardEvents";
import { createElement } from "./ElementFactory";
import type { CanvasElement, ArrowElement } from "@murmur/shared";

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

interface DragState {
  isDragging: boolean;
  startWorldX: number;
  startWorldY: number;
  startScreenX: number;
  startScreenY: number;
  elementStartPositions: Map<string, { x: number; y: number }>;
}

interface ResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  elementId: string | null;
  startWorldX: number;
  startWorldY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

interface RotateState {
  isRotating: boolean;
  elementId: string | null;
  cx: number;
  cy: number;
  startAngle: number;
  startRotation: number;
}

interface ArrowDragState {
  isDragging: boolean;
  elementId: string | null;
  pointIndex: number;
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

  private resize: ResizeState = {
    isResizing: false,
    handle: null,
    elementId: null,
    startWorldX: 0,
    startWorldY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  };

  private rotate: RotateState = {
    isRotating: false,
    elementId: null,
    cx: 0,
    cy: 0,
    startAngle: 0,
    startRotation: 0,
  };

  private arrowDrag: ArrowDragState = {
    isDragging: false,
    elementId: null,
    pointIndex: -1,
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
    private onElementCreated?: (id: string) => void,
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

    if (e.button === 1) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (e.button === 0 && tool === "select" && e.altKey) {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (tool !== "select") {
      const element = createElement(
        tool,
        worldPos.x,
        worldPos.y,
        this.boardId,
        this.userId,
      );
      getBoardState().addElement(element);
      emitCreateElement(element);
      this.onElementCreated?.(element.id);
      useSelectionStore.getState().select(element.id);
      useSelectionStore.getState().setActiveTool("select");
      this.onDirty();
      return;
    }

    if (tool === "select") {
      const elementsArray = Object.values(elements);
      const { selectedIds } = getSelectionState();

      // check rotation handle
      if (selectedIds.size === 1) {
        const selectedId = Array.from(selectedIds)[0]!;
        const el = elements[selectedId];
        if (el) {
          const isRotateHandle = this.hitTester.hitTestRotateHandle(
            worldPos.x,
            worldPos.y,
            el,
            this.viewport.state.scale,
          );
          if (isRotateHandle) {
            this.rotate = {
              isRotating: true,
              elementId: el.id,
              cx: el.x + el.width / 2,
              cy: el.y + el.height / 2,
              startAngle: Math.atan2(
                worldPos.y - (el.y + el.height / 2),
                worldPos.x - (el.x + el.width / 2),
              ),
              startRotation: el.rotation,
            };
            return;
          }
        }
      }

      // check resize handles
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
          if (handle) {
            this.resize = {
              isResizing: true,
              handle,
              elementId: el.id,
              startWorldX: worldPos.x,
              startWorldY: worldPos.y,
              startX: el.x,
              startY: el.y,
              startWidth: el.width,
              startHeight: el.height,
            };
            return;
          }
        }
      }

      // check arrow endpoint dragging
      const hitArrow = this.hitTester.hitTest(
        worldPos.x,
        worldPos.y,
        elementsArray,
        zOrder,
      );
      if (hitArrow && hitArrow.element.type === "arrow") {
        const arrow = hitArrow.element as ArrowElement;
        const tolerance = 10 / this.viewport.state.scale;
        for (let i = 0; i < arrow.points.length; i++) {
          const pt = arrow.points[i]!;
          if (Math.hypot(worldPos.x - pt.x, worldPos.y - pt.y) < tolerance) {
            this.arrowDrag = {
              isDragging: true,
              elementId: arrow.id,
              pointIndex: i,
            };
            useSelectionStore.getState().select(arrow.id);
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

    if (this.rotate.isRotating && this.rotate.elementId) {
      const angle = Math.atan2(
        worldPos.y - this.rotate.cy,
        worldPos.x - this.rotate.cx,
      );
      const rotation =
        this.rotate.startRotation + (angle - this.rotate.startAngle);
      getBoardState().updateElement({ id: this.rotate.elementId, rotation });
      this.onDirty();
      return;
    }

    if (this.resize.isResizing && this.resize.elementId && this.resize.handle) {
      const dx = worldPos.x - this.resize.startWorldX;
      const dy = worldPos.y - this.resize.startWorldY;
      const { startX, startY, startWidth, startHeight, handle } = this.resize;

      let newX = startX;
      let newY = startY;
      let newW = startWidth;
      let newH = startHeight;

      switch (handle) {
        case "se":
          newW = Math.max(40, startWidth + dx);
          newH = Math.max(40, startHeight + dy);
          break;
        case "sw":
          newX = startX + dx;
          newW = Math.max(40, startWidth - dx);
          newH = Math.max(40, startHeight + dy);
          break;
        case "ne":
          newW = Math.max(40, startWidth + dx);
          newY = startY + dy;
          newH = Math.max(40, startHeight - dy);
          break;
        case "nw":
          newX = startX + dx;
          newW = Math.max(40, startWidth - dx);
          newY = startY + dy;
          newH = Math.max(40, startHeight - dy);
          break;
        case "e":
          newW = Math.max(40, startWidth + dx);
          break;
        case "w":
          newX = startX + dx;
          newW = Math.max(40, startWidth - dx);
          break;
        case "s":
          newH = Math.max(40, startHeight + dy);
          break;
        case "n":
          newY = startY + dy;
          newH = Math.max(40, startHeight - dy);
          break;
      }

      getBoardState().updateElement({
        id: this.resize.elementId,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
      this.onDirty();
      return;
    }

    if (this.arrowDrag.isDragging && this.arrowDrag.elementId) {
      const { elements } = getBoardState();
      const el = elements[this.arrowDrag.elementId];
      if (el && el.type === "arrow") {
        const newPoints = [...el.points];
        newPoints[this.arrowDrag.pointIndex] = { x: worldPos.x, y: worldPos.y };
        getBoardState().updateElement({ id: el.id, points: newPoints } as any);
        this.onDirty();
      }
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

    if (
      !this.drag.isDragging &&
      !this.resize.isResizing &&
      !this.rotate.isRotating &&
      !this.isPanning
    ) {
      const { elements } = getBoardState();
      const { selectedIds } = getSelectionState();
      const scale = this.viewport.state.scale;

      if (selectedIds.size === 1) {
        const id = Array.from(selectedIds)[0]!;
        const el = elements[id];
        if (el) {
          const isRotate = this.hitTester.hitTestRotateHandle(
            worldPos.x,
            worldPos.y,
            el,
            scale,
          );
          if (isRotate) {
            this.canvas.style.cursor = "crosshair";
            return;
          }

          const handle = this.hitTester.hitTestHandle(
            worldPos.x,
            worldPos.y,
            el,
            scale,
          );
          if (handle) {
            const cursors: Record<ResizeHandle, string> = {
              nw: "nw-resize",
              n: "n-resize",
              ne: "ne-resize",
              e: "e-resize",
              se: "se-resize",
              s: "s-resize",
              sw: "sw-resize",
              w: "w-resize",
            };
            this.canvas.style.cursor = cursors[handle];
            return;
          }
        }
      }

      const hit = this.hitTester.hitTest(
        worldPos.x,
        worldPos.y,
        Object.values(elements),
        getBoardState().zOrder,
      );
      this.canvas.style.cursor = hit ? "move" : "default";
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

    if (this.resize.isResizing && this.resize.elementId) {
      const { elements } = getBoardState();
      const el = elements[this.resize.elementId];
      if (el)
        emitUpdateElement({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        });
      this.resize = {
        isResizing: false,
        handle: null,
        elementId: null,
        startWorldX: 0,
        startWorldY: 0,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
      };
    }

    if (this.rotate.isRotating && this.rotate.elementId) {
      const { elements } = getBoardState();
      const el = elements[this.rotate.elementId];
      if (el) emitUpdateElement({ id: el.id, rotation: el.rotation });
      this.rotate = {
        isRotating: false,
        elementId: null,
        cx: 0,
        cy: 0,
        startAngle: 0,
        startRotation: 0,
      };
    }

    if (this.arrowDrag.isDragging && this.arrowDrag.elementId) {
      const { elements } = getBoardState();
      const el = elements[this.arrowDrag.elementId];
      if (el && el.type === "arrow")
        emitUpdateElement({ id: el.id, points: el.points } as any);
      this.arrowDrag = { isDragging: false, elementId: null, pointIndex: -1 };
    }

    const { isMarqueeSelecting } = getSelectionState();
    if (isMarqueeSelecting) useSelectionStore.getState().endMarquee();

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
      rect: "crosshair",
      square: "crosshair",
      ellipse: "crosshair",
      circle: "crosshair",
      cloud: "crosshair",
      arrow: "crosshair",
      text: "text",
      freehand: "crosshair",
    };
    this.canvas.style.cursor = cursors[tool];
  }
}
