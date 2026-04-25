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
      // callback when user double-clicks an element
      (element: CanvasElement) => {
        if (element.type !== "sticky_note" && element.type !== "text_box")
          return;
        const content = "content" in element ? element.content : "";
        const fontSize = "fontSize" in element ? element.fontSize : 14;

        // read viewport directly from store — not from closed-over React state
        const vp = useViewportStore.getState();

        const screenX = element.x * vp.scale + vp.x;
        const screenY = element.y * vp.scale + vp.y;

        setEditing({
          elementId: element.id,
          x: screenX,
          y: screenY,
          width: element.width * vp.scale,
          height: element.height * vp.scale,
          content,
          fontSize: fontSize * vp.scale,
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

  // mark dirty whenever elements change
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
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <textarea
      ref={ref}
      defaultValue={editing.content}
      className={styles.textEditor}
      style={{
        left: editing.x + 12 * (editing.fontSize / 14),
        top: editing.y + 12 * (editing.fontSize / 14),
        width: editing.width - 24 * (editing.fontSize / 14),
        height: editing.height - 24 * (editing.fontSize / 14),
        fontSize: editing.fontSize,
        lineHeight: 1.4,
      }}
      onBlur={(e) => onBlur(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onBlur(e.currentTarget.value);
        }
        e.stopPropagation();
      }}
    />
  );
}
