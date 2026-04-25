import type {
  CanvasElement,
  ShapeElement,
  TextElement,
  ArrowElement,
  FreehandElement,
} from "@murmur/shared";

import type { Viewport } from "./Viewport";
import { getSelectionState, getMarqueeBounds } from "../store/selectionStore";

const HANDLE_SIZE = 8;
const SELECTION_COLOR = "hsl(248 65% 65%)";
const SELECTION_FILL = "hsl(248 65% 65% / 0.1)";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  editingId: string | null = null;
  elementBirthTimes = new Map<string, number>();

  constructor(ctx: CanvasRenderingContext2D, viewport: Viewport) {
    this.ctx = ctx;
    this.viewport = viewport;
  }

  trackNewElement(id: string) {
    this.elementBirthTimes.set(id, Date.now());
  }

  render(elements: CanvasElement[], zOrder: string[]) {
    const ctx = this.ctx;
    const canvas = ctx.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawGrid();
    this.viewport.applyTransform(ctx);

    for (const id of zOrder) {
      const el = elements.find((e) => e.id === id);
      if (el) this.drawElement(el);
    }

    this.drawSelections(elements);
    this.drawMarquee();
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

    if (el.rotation !== 0 && el.type !== "arrow" && el.type !== "freehand") {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(el.rotation);
      ctx.translate(-cx, -cy);
    }

    switch (el.type) {
      case "shape":
        this.drawShape(el);
        break;
      case "text":
        this.drawText(el);
        break;
      case "arrow":
        this.drawArrow(el);
        break;
      case "freehand":
        this.drawFreehand(el);
        break;
    }

    ctx.restore();
  }

  private drawShape(el: ShapeElement) {
    const ctx = this.ctx;
    ctx.fillStyle = el.fillColor;
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    this.applyStrokeStyle(el.strokeStyle);

    switch (el.kind) {
      case "rect":
      case "square":
        this.roundRect(el.x, el.y, el.width, el.height, 4);
        ctx.fill();
        if (el.strokeWidth > 0) ctx.stroke();
        break;

      case "ellipse":
      case "circle":
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

      case "cloud":
        this.drawCloud(el);
        break;
    }

    this.resetStrokeStyle();
  }
  private drawCloud(el: ShapeElement) {
    const ctx = this.ctx;
    const arcs = el.cloudArcs ?? 6;
    const arcSize = el.cloudArcSize ?? 0.5;
    const { x, y, width, height } = el;

    const bumpH = Math.min(width, height) * 0.12 * (arcSize + 0.3);
    const hArcs = arcs;
    const vArcs = Math.max(1, Math.round(arcs * (height / width)));

    ctx.beginPath();
    ctx.moveTo(x, y);

    // top edge left to right
    for (let i = 0; i < hArcs; i++) {
      const x0 = x + (i / hArcs) * width;
      const x1 = x + ((i + 1) / hArcs) * width;
      const mx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(mx, y - bumpH, x1, y);
    }

    // right edge top to bottom
    for (let i = 0; i < vArcs; i++) {
      const y0 = y + (i / vArcs) * height;
      const y1 = y + ((i + 1) / vArcs) * height;
      const my = (y0 + y1) / 2;
      ctx.quadraticCurveTo(x + width + bumpH, my, x + width, y1);
    }

    // bottom edge right to left
    for (let i = hArcs - 1; i >= 0; i--) {
      const x0 = x + ((i + 1) / hArcs) * width;
      const x1 = x + (i / hArcs) * width;
      const mx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(mx, y + height + bumpH, x1, y + height);
    }

    // left edge bottom to top
    for (let i = vArcs - 1; i >= 0; i--) {
      const y0 = y + ((i + 1) / vArcs) * height;
      const y1 = y + (i / vArcs) * height;
      const my = (y0 + y1) / 2;
      ctx.quadraticCurveTo(x - bumpH, my, x, y1);
    }

    ctx.closePath();
    ctx.fill();
    if (el.strokeWidth > 0) ctx.stroke();
  }

  private drawText(el: TextElement) {
    const ctx = this.ctx;

    // background
    if (el.fillColor !== "transparent") {
      ctx.fillStyle = el.fillColor;
      this.roundRect(el.x, el.y, el.width, el.height, 4);
      ctx.fill();
    }

    // border
    if (el.strokeWidth > 0 && el.strokeColor !== "transparent") {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      this.applyStrokeStyle(el.strokeStyle);
      this.roundRect(el.x, el.y, el.width, el.height, 4);
      ctx.stroke();
      this.resetStrokeStyle();
    }

    // text
    if (this.editingId !== el.id && el.content) {
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontWeight} ${el.fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = el.align as CanvasTextAlign;
      ctx.textBaseline = "top";

      const textX =
        el.align === "center"
          ? el.x + el.width / 2
          : el.align === "right"
            ? el.x + el.width - 8
            : el.x + 8;

      // clip text vertically
      ctx.save();
      ctx.beginPath();
      ctx.rect(el.x, el.y, el.width, el.height);
      ctx.clip();
      this.drawWrappedText(
        el.content,
        textX,
        el.y + 8,
        el.width - 16,
        el.fontSize * 1.4,
      );
      ctx.restore();
    }
  }
  private drawFreehand(el: FreehandElement) {
    const ctx = this.ctx;
    const points = el.points;
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = el.opacity;
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.applyStrokeStyle(el.strokeStyle);

    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
    this.resetStrokeStyle();
    ctx.restore();
  }

  private drawArrow(el: ArrowElement) {
    const ctx = this.ctx;
    const points = el.points;
    if (points.length < 2) return;

    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.applyStrokeStyle(el.strokeStyle);

    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
    this.resetStrokeStyle();

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

  // ─── Element bounds ──────────────────────────────────────────────────────────

  getElementBounds(el: CanvasElement): {
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

  // ─── Selection ───────────────────────────────────────────────────────────────

  private drawSelections(elements: CanvasElement[]) {
    const { selectedIds } = getSelectionState();
    if (selectedIds.size === 0) return;

    const ctx = this.ctx;
    const scale = this.viewport.state.scale;

    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      ctx.save();

      if (el.rotation !== 0 && el.type !== "arrow" && el.type !== "freehand") {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }

      const bounds = this.getElementBounds(el);
      const pad = (el.type === "text" ? 4 : 8) / scale;

      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([]);
      this.roundRect(
        bounds.x - pad,
        bounds.y - pad,
        bounds.width + pad * 2,
        bounds.height + pad * 2,
        4,
      );
      ctx.stroke();

      this.drawHandles(el, scale);

      ctx.restore();
    }
  }

  private drawHandles(el: CanvasElement, scale: number) {
    const ctx = this.ctx;
    const size = HANDLE_SIZE / scale;

    const rawBounds = this.getElementBounds(el);
    const pad = (el.type === "text" ? 4 : 8) / scale;
    const x = rawBounds.x - pad;
    const y = rawBounds.y - pad;
    const width = rawBounds.width + pad * 2;
    const height = rawBounds.height + pad * 2;

    const positions = [
      { x, y },
      { x: x + width / 2, y },
      { x: x + width, y },
      { x: x + width, y: y + height / 2 },
      { x: x + width, y: y + height },
      { x: x + width / 2, y: y + height },
      { x, y: y + height },
      { x, y: y + height / 2 },
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

    // rotation handle — skip for arrows and freehand
    if (el.type === "arrow" || el.type === "freehand") return;

    const rotateX = x + width / 2;
    const rotateY = y - 24 / scale;

    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(rotateX, rotateY);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1.5 / scale;
    ctx.beginPath();
    ctx.arc(rotateX, rotateY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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

  private applyStrokeStyle(style: "solid" | "dashed" | "dotted") {
    const ctx = this.ctx;
    switch (style) {
      case "dashed":
        ctx.setLineDash([8, 4]);
        break;
      case "dotted":
        ctx.setLineDash([2, 4]);
        break;
      default:
        ctx.setLineDash([]);
        break;
    }
  }

  private resetStrokeStyle() {
    this.ctx.setLineDash([]);
  }

  private drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ) {
    const ctx = this.ctx;
    const paragraphs = text.split("\n");
    let currentY = y;

    for (const paragraph of paragraphs) {
      if (paragraph === "") {
        currentY += lineHeight;
        continue;
      }

      const words = paragraph.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, x, currentY);
          line = word;
          currentY += lineHeight;
        } else if (ctx.measureText(word).width > maxWidth) {
          if (line) {
            ctx.fillText(line, x, currentY);
            line = "";
            currentY += lineHeight;
          }
          let chars = "";
          for (const char of word) {
            const test = chars + char;
            if (ctx.measureText(test).width > maxWidth && chars) {
              ctx.fillText(chars, x, currentY);
              chars = char;
              currentY += lineHeight;
            } else {
              chars = test;
            }
          }
          line = chars;
        } else {
          line = testLine;
        }
      }

      if (line) {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
      }
    }
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
