import { useEffect, useRef } from "react";
import { CanvasEngine } from "../canvas/CanvasEngine";
import { getCurrentUser } from "../api/me";
import styles from "./BoardCanvas.module.css";

interface Props {
  boardId: string;
  role: string;
}

export function BoardCanvas({ boardId, role }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const user = getCurrentUser();
    const userId = user?.userId ?? "anonymous";

    engineRef.current = new CanvasEngine(canvas, overlay, boardId, userId);

    const handleResize = () => engineRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      window.removeEventListener("resize", handleResize);
    };
  }, [boardId]);

  // mark dirty when board state changes
  useEffect(() => {
    engineRef.current?.markDirty();
  });

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
    </div>
  );
}
