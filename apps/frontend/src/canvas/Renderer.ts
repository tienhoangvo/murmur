import type {
  CanvasElement,
  StickyNoteElement,
  TextBoxElement,
  ShapeElement,
  ArrowElement,
} from "@murmur/shared";
import type { Viewport } from "./Viewport";
import { getSelectionState, getMarqueeBounds } from "../store/selectionStore";

const STICKY_COLORS: Record<string, string> = {
  yellow: "hsl(48 95% 76%)",
  pink: "hsl(340 85% 82%)",
  blue: "hsl(210 85% 78%)",
  green: "hsl(152 60% 74%)",
  purple: "hsl(270 70% 80%)",
  orange: "hsl(28 90% 74%)",
};

const HANDLE_SIZE = 8;
const SELECTION_COLOR = "hsl(248 65% 65%)";
const SELECTION_FILL = "hsl(248 65% 65% / 0.1)";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;

  constructor(ctx: CanvasRenderingContext2D, viewport: Viewport) {
    this.ctx = ctx;
    this.viewport = viewport;
  }

  render(elements: CanvasElement[], zOrder: string[]) {
    const ctx = this.ctx;
    const canvas = ctx.canvas;

    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw grid
    this.drawGrid();

    // apply viewport transform
    this.viewport.applyTransform(ctx);

    // draw elements in z-order
    for (const id of zOrder) {
      const el = elements.find((e) => e.id === id);
      if (el) this.drawElement(el);
    }

    // draw selection overlays
    this.drawSelections(elements);

    // draw marquee
    this.drawMarquee();

    // reset transform
    this.viewport.resetTransform(ctx);
  }

  private drawGrid() {
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    const { x, y, scale } = this.viewport.state;
    const dpr = window.devicePixelRatio ?? 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const gridSize = 24 * scale;
    const offsetX = x % gridSize;
    const offsetY = y % gridSize;

    ctx.save();
    ctx.strokeStyle = "hsl(220 12% 86% / 0.8)";
    ctx.lineWidth = 0.5;

    for (let gx = offsetX; gx < w; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    for (let gy = offsetY; gy < h; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawElement(el: CanvasElement) {
    const ctx = this.ctx;
    ctx.save();

    // apply rotation around element center
    if (el.rotation !== 0) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(el.rotation);
      ctx.translate(-cx, -cy);
    }

    switch (el.type) {
      case "sticky_note":
        this.drawStickyNote(el);
        break;
      case "text_box":
        this.drawTextBox(el);
        break;
      case "shape":
        this.drawShape(el);
        break;
      case "arrow":
        this.drawArrow(el);
        break;
      case "image":
        break; // handled separately
    }

    ctx.restore();
  }

  private drawStickyNote(el: StickyNoteElement) {
    const ctx = this.ctx;
    const color = STICKY_COLORS[el.color] ?? STICKY_COLORS["yellow"]!;

    // shadow
    ctx.shadowColor = "hsl(0 0% 0% / 0.12)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // background
    ctx.fillStyle = color!;
    this.roundRect(el.x, el.y, el.width, el.height, 4);
    ctx.fill();

    ctx.shadowColor = "transparent";

    // text
    ctx.fillStyle = "hsl(220 15% 15%)";
    ctx.font = `${el.fontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    this.drawWrappedText(
      el.content,
      el.x + 12,
      el.y + 12,
      el.width - 24,
      el.fontSize * 1.4,
    );
  }

  private drawTextBox(el: TextBoxElement) {
    const ctx = this.ctx;

    ctx.fillStyle = el.color;
    ctx.font = `${el.fontWeight} ${el.fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = el.align as CanvasTextAlign;
    ctx.textBaseline = "top";

    const textX =
      el.align === "center"
        ? el.x + el.width / 2
        : el.align === "right"
          ? el.x + el.width
          : el.x;

    this.drawWrappedText(el.content, textX, el.y, el.width, el.fontSize * 1.4);
  }

  private drawShape(el: ShapeElement) {
    const ctx = this.ctx;

    ctx.fillStyle = el.fillColor;
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;

    switch (el.shape) {
      case "rect":
        this.roundRect(el.x, el.y, el.width, el.height, 4);
        ctx.fill();
        if (el.strokeWidth > 0) ctx.stroke();
        break;

      case "ellipse":
        ctx.beginPath();
        ctx.ellipse(
          el.x + el.width / 2,
          el.y + el.height / 2,
          el.width / 2,
          el.height / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (el.strokeWidth > 0) ctx.stroke();
        break;

      case "triangle":
        ctx.beginPath();
        ctx.moveTo(el.x + el.width / 2, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height);
        ctx.lineTo(el.x, el.y + el.height);
        ctx.closePath();
        ctx.fill();
        if (el.strokeWidth > 0) ctx.stroke();
        break;

      case "diamond":
        ctx.beginPath();
        ctx.moveTo(el.x + el.width / 2, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height / 2);
        ctx.lineTo(el.x + el.width / 2, el.y + el.height);
        ctx.lineTo(el.x, el.y + el.height / 2);
        ctx.closePath();
        ctx.fill();
        if (el.strokeWidth > 0) ctx.stroke();
        break;
    }
  }

  private drawArrow(el: ArrowElement) {
    const ctx = this.ctx;
    const points = el.points;
    if (points.length < 2) return;

    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    const first = points[0]!;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();

    // draw arrowhead at end
    if (el.endCap === "arrow") {
      const last = points[points.length - 1]!;
      const prev = points[points.length - 2]!;
      this.drawArrowhead(
        last.x,
        last.y,
        prev.x,
        prev.y,
        el.strokeColor,
        el.strokeWidth,
      );
    }
  }

  private drawArrowhead(
    tx: number,
    ty: number,
    fx: number,
    fy: number,
    color: string,
    size: number,
  ) {
    const ctx = this.ctx;
    const angle = Math.atan2(ty - fy, tx - fx);
    const len = size * 4;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(
      tx - len * Math.cos(angle - Math.PI / 6),
      ty - len * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      tx - len * Math.cos(angle + Math.PI / 6),
      ty - len * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawSelections(elements: CanvasElement[]) {
    const { selectedIds } = getSelectionState();
    if (selectedIds.size === 0) return;

    const ctx = this.ctx;
    const scale = this.viewport.state.scale;

    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      // selection border
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([]);
      this.roundRect(
        el.x - 2 / scale,
        el.y - 2 / scale,
        el.width + 4 / scale,
        el.height + 4 / scale,
        4,
      );
      ctx.stroke();

      // resize handles
      if (el.type !== "arrow") {
        this.drawHandles(el, scale);
      }
    }
  }

  private drawHandles(el: CanvasElement, scale: number) {
    const ctx = this.ctx;
    const size = HANDLE_SIZE / scale;
    const positions = [
      { x: el.x, y: el.y },
      { x: el.x + el.width / 2, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x + el.width, y: el.y + el.height / 2 },
      { x: el.x + el.width, y: el.y + el.height },
      { x: el.x + el.width / 2, y: el.y + el.height },
      { x: el.x, y: el.y + el.height },
      { x: el.x, y: el.y + el.height / 2 },
    ];

    for (const pos of positions) {
      ctx.fillStyle = "white";
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.rect(pos.x - size / 2, pos.y - size / 2, size, size);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawMarquee() {
    const { isMarqueeSelecting, marqueeStart, marqueeEnd } =
      getSelectionState();
    if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) return;

    const ctx = this.ctx;
    const bounds = getMarqueeBounds(marqueeStart, marqueeEnd);

    ctx.fillStyle = SELECTION_FILL;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / this.viewport.state.scale;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);
  }

  private drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ) {
    const ctx = this.ctx;
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line) ctx.fillText(line, x, currentY);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
