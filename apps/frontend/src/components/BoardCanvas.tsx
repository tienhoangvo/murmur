import { useEffect, useRef, useState } from "react";
import { CanvasEngine } from "../canvas/CanvasEngine";
import { getCurrentUser } from "../api/me";
import { useBoardStore } from "../store/boardStore";
import { emitUpdateElement } from "../socket/boardEvents";
import { useViewportStore } from "../store/viewportStore";
import type { CanvasElement } from "@murmur/shared";
import styles from "./BoardCanvas.module.css";

interface Props {
  boardId: string;
  role: string;
}

interface EditingState {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  color: string;
  scale: number;
  rotation: number;
}

export function BoardCanvas({ boardId, role }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const user = getCurrentUser();
    const userId = user?.userId ?? "anonymous";

    engineRef.current = new CanvasEngine(
      canvas,
      overlay,
      boardId,
      userId,
      (element: CanvasElement) => {
        if (element.type !== "text") return;

        const vp = useViewportStore.getState();
        const screenX = element.x * vp.scale + vp.x;
        const screenY = element.y * vp.scale + vp.y;

        setEditing({
          elementId: element.id,
          x: screenX,
          y: screenY,
          width: element.width * vp.scale,
          height: element.height * vp.scale,
          content: element.content,
          fontSize: element.fontSize * vp.scale,
          fontWeight: element.fontWeight,
          align: element.align,
          color: element.color,
          scale: vp.scale,
          rotation: element.rotation,
        });

        engineRef.current?.setEditingId(element.id);
      },
    );

    const handleResize = () => engineRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      window.removeEventListener("resize", handleResize);
    };
  }, [boardId]);

  useEffect(() => {
    const unsub = useBoardStore.subscribe(() => {
      engineRef.current?.markDirty();
    });
    return unsub;
  }, []);

  function handleEditBlur(content: string) {
    if (!editing) return;
    useBoardStore.getState().updateElement({
      id: editing.elementId,
      content,
    } as any);
    emitUpdateElement({ id: editing.elementId, content } as any);
    setEditing(null);
    engineRef.current?.setEditingId(null);
    engineRef.current?.markDirty();
  }

  const isReadOnly = role === "viewer";

  return (
    <div className={styles.root}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ pointerEvents: isReadOnly ? "none" : "auto" }}
      />
      <canvas
        ref={overlayRef}
        className={styles.overlay}
        style={{ pointerEvents: "none" }}
      />
      {editing && <TextEditor editing={editing} onBlur={handleEditBlur} />}
    </div>
  );
}

function TextEditor({
  editing,
  onBlur,
}: {
  editing: EditingState;
  onBlur: (content: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  // canvas draws at y+8 with textBaseline=top
  // contentEditable adds half-leading above first line = (lineHeight - fontSize) / 2
  // at fontSize=16, lineHeight=16*1.4=22.4, half-leading = 3.2px
  // so paddingTop = 8 - 3.2 = ~5px
  const halfLeading = (editing.fontSize * 0.4) / 2;
  const paddingTop = Math.max(0, 8 * editing.scale - halfLeading);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={styles.textEditor}
      style={{
        left: editing.x,
        top: editing.y,
        width: editing.width,
        height: editing.height,
        fontSize: editing.fontSize,
        lineHeight: `${editing.fontSize * 1.4}px`,
        fontWeight: editing.fontWeight,
        textAlign: editing.align,
        color: editing.color,
        fontFamily: "Inter, system-ui, sans-serif",
        paddingTop,
        paddingLeft: 8 * editing.scale,
        paddingRight: 8 * editing.scale,
        paddingBottom: 8 * editing.scale,
        boxSizing: "border-box",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        transform: `rotate(${editing.rotation}rad)`,
        transformOrigin: "center center",
      }}
      onBlur={(e) => onBlur(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        // prevent browser rich text shortcuts
        if (
          (e.metaKey || e.ctrlKey) &&
          ["b", "i", "u"].includes(e.key.toLowerCase())
        ) {
          e.preventDefault();
        }
        if (e.key === "Escape") onBlur(e.currentTarget.innerText);
        e.stopPropagation();
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
    >
      {editing.content}
    </div>
  );
}
