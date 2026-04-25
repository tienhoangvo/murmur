import type {
  CanvasElement,
  ShapeElement,
  TextElement,
  ArrowElement,
  FreehandElement,
  ShapeKind,
} from "@murmur/shared";

type CreationTool =
  | "rect"
  | "square"
  | "ellipse"
  | "circle"
  | "cloud"
  | "arrow"
  | "text"
  | "freehand";

export function createElement(
  tool: CreationTool,
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
    case "rect":
    case "square":
    case "ellipse":
    case "circle":
    case "cloud":
      return {
        ...base,
        type: "shape",
        kind: tool as ShapeKind,
        width: tool === "square" || tool === "circle" ? 160 : 200,
        height: 160,
        fillColor: "hsl(0 0% 100%)",
        strokeColor: "hsl(220 10% 74%)",
        strokeWidth: 1,
        strokeStyle: "solid",
        ...(tool === "cloud" && { cloudArcs: 6, cloudArcSize: 0.5 }),
      } satisfies ShapeElement;

    case "text":
      return {
        ...base,
        type: "text",
        width: 200,
        height: 32,
        content: "Text",
        fontSize: 16,
        fontWeight: "normal",
        align: "left",
        color: "hsl(220 15% 15%)",
        fillColor: "transparent",
        strokeColor: "transparent",
        strokeWidth: 0,
        strokeStyle: "solid",
      } satisfies TextElement;

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
        strokeStyle: "solid",
        startCap: "none",
        endCap: "arrow",
      } satisfies ArrowElement;

    case "freehand":
      return {
        ...base,
        type: "freehand",
        width: 0,
        height: 0,
        points: [{ x, y }],
        strokeColor: "hsl(220 15% 30%)",
        strokeWidth: 2,
        strokeStyle: "solid",
        opacity: 1,
      } satisfies FreehandElement;
  }
}
