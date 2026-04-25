import type {
  CanvasElement,
  StickyNoteElement,
  TextBoxElement,
  ShapeElement,
  ArrowElement,
} from "@murmur/shared";

type Tool = "sticky_note" | "text_box" | "shape" | "arrow";

export function createElement(
  tool: Tool,
  x: number,
  y: number,
  boardId: string,
  userId: string,
): CanvasElement {
  const base = {
    id: crypto.randomUUID(),
    boardId,
    createdBy: userId,
    x,
    y,
    rotation: 0,
    zIndex: Date.now(),
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  switch (tool) {
    case "sticky_note":
      return {
        ...base,
        type: "sticky_note",
        width: 200,
        height: 200,
        content: "",
        color: randomStickyColor(),
        fontSize: 14,
      } satisfies StickyNoteElement;

    case "text_box":
      return {
        ...base,
        type: "text_box",
        width: 200,
        height: 60,
        content: "",
        fontSize: 16,
        fontWeight: "normal",
        align: "left",
        color: "hsl(220 15% 15%)",
      } satisfies TextBoxElement;

    case "shape":
      return {
        ...base,
        type: "shape",
        width: 160,
        height: 160,
        shape: "rect",
        fillColor: "hsl(248 65% 65% / 0.15)",
        strokeColor: "hsl(248 65% 65%)",
        strokeWidth: 2,
      } satisfies ShapeElement;

    case "arrow":
      return {
        ...base,
        type: "arrow",
        width: 0,
        height: 0,
        points: [
          { x, y },
          { x: x + 120, y },
        ],
        strokeColor: "hsl(220 15% 30%)",
        strokeWidth: 2,
        startCap: "none",
        endCap: "arrow",
      } satisfies ArrowElement;
  }
}

const STICKY_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
] as const;

function randomStickyColor() {
  return STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)]!;
}
