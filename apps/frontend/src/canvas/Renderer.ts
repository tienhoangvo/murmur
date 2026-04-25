import type {
  CanvasElement,
  ShapeElement,
  TextElement,
  ArrowElement,
  FreehandElement,
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
  editingId: string | null = null;

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

    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    ctx.beginPath();

    for (let i = 0; i < arcs; i++) {
      const startAngle = (i / arcs) * Math.PI * 2;
      const endAngle = ((i + 1) / arcs) * Math.PI * 2;
      const midAngle = (startAngle + endAngle) / 2;

      const bumpX = cx + Math.cos(midAngle) * rx * (1 + arcSize * 0.3);
      const bumpY = cy + Math.sin(midAngle) * ry * (1 + arcSize * 0.3);
      const bumpR = Math.min(rx, ry) * arcSize * 0.6;

      ctx.arc(bumpX, bumpY, bumpR, midAngle + Math.PI, midAngle, false);
    }

    ctx.closePath();
    ctx.fill();
    if (el.strokeWidth > 0) ctx.stroke();
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
      const p = points[i]!;
      ctx.lineTo(p.x, p.y);
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
    const first = points[0]!;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();

    this.resetStrokeStyle();

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

      ctx.save();

      // rotate selection around element center
      if (el.rotation !== 0) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }

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

      ctx.restore();
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

    // rotation handle — circle above top center
    const rotateY = el.y - 24 / scale;
    const rotateX = el.x + el.width / 2;

    // line from top center to rotation handle
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    ctx.moveTo(el.x + el.width / 2, el.y);
    ctx.lineTo(rotateX, rotateY);
    ctx.stroke();

    // circle handle
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
          // word itself is too long — break at character level
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
