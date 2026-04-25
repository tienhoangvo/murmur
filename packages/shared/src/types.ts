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

export interface StickyNoteElement extends BaseElement {
  type: "sticky_note";
  content: string;
  color: StickyColor;
  fontSize: number;
}

export interface TextBoxElement extends BaseElement {
  type: "text_box";
  content: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  color: string;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: "rect" | "ellipse" | "triangle" | "diamond";
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export interface ArrowElement extends BaseElement {
  type: "arrow";
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  startCap: ArrowCap;
  endCap: ArrowCap;
}

export interface ImageElement extends BaseElement {
  type: "image";
  url: string;
}

export type CanvasElement =
  | StickyNoteElement
  | TextBoxElement
  | ShapeElement
  | ArrowElement
  | ImageElement;

export type ElementType = CanvasElement["type"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type StickyColor =
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "purple"
  | "orange";

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
