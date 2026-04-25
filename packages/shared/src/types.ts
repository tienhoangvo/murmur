// ─── Base ────────────────────────────────────────────────────────────────────

export type Role = "owner" | "editor" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
}

export interface TeamMember {
  user: User;
  role: Role;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  createdAt: string;
}

export interface Board {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Canvas elements ─────────────────────────────────────────────────────────

export interface BaseElement {
  id: string;
  boardId: string;
  createdBy: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Shape types ─────────────────────────────────────────────────────────────

export type ShapeKind = "rect" | "square" | "ellipse" | "circle" | "cloud";

export interface ShapeElement extends BaseElement {
  type: "shape";
  kind: ShapeKind;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  // cloud specific
  cloudArcs?: number; // number of arcs (3–12), default 6
  cloudArcSize?: number; // arc roundness (0.1–1.0), default 0.5
}

// ─── Text ────────────────────────────────────────────────────────────────────

export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  color: string;
  fillColor: string; // background, default transparent
  strokeColor: string; // border, default transparent
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
}

// ─── Arrow ───────────────────────────────────────────────────────────────────

export interface ArrowElement extends BaseElement {
  type: "arrow";
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  startCap: ArrowCap;
  endCap: ArrowCap;
}

// ─── Freehand ────────────────────────────────────────────────────────────────

export interface FreehandElement extends BaseElement {
  type: "freehand";
  points: Point[]; // raw path points
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  opacity: number; // 0–1
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type CanvasElement =
  | ShapeElement
  | TextElement
  | ArrowElement
  | FreehandElement;

export type ElementType = CanvasElement["type"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type ArrowCap = "none" | "arrow" | "dot";

export type ElementUpdate = { id: string } & {
  [K in keyof Omit<
    BaseElement,
    "id" | "boardId" | "createdBy" | "createdAt"
  >]?: BaseElement[K];
} & {
  data?: Record<string, unknown>;
};

// ─── Presence ────────────────────────────────────────────────────────────────

export interface Presence {
  userId: string;
  name: string;
  avatarColor: string;
  cursor: Point | null;
  activeTool: string;
}

// ─── Socket.io event maps ────────────────────────────────────────────────────

export interface ClientToServerEvents {
  "board:join": (
    boardId: string,
    cb: (snapshot: CanvasElement[]) => void,
  ) => void;
  "board:leave": (boardId: string) => void;
  "element:create": (element: CanvasElement) => void;
  "element:update": (update: ElementUpdate) => void;
  "element:delete": (elementId: string) => void;
  "element:reorder": (elementId: string, zIndex: number) => void;
  "presence:update": (data: Pick<Presence, "cursor" | "activeTool">) => void;
}

export interface ServerToClientEvents {
  "element:created": (element: CanvasElement) => void;
  "element:updated": (update: ElementUpdate) => void;
  "element:deleted": (elementId: string) => void;
  "element:reordered": (elementId: string, zIndex: number) => void;
  "presence:state": (members: Presence[]) => void;
  "presence:updated": (data: Presence) => void;
  "presence:left": (userId: string) => void;
}

// ─── API shapes ──────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
