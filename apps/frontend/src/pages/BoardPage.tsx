import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBoard } from "../api/boards";
import { connectSocket, disconnectSocket } from "../socket/socketClient";
import {
  joinBoard,
  leaveBoard,
  registerBoardListeners,
  unregisterBoardListeners,
} from "../socket/boardEvents";
import { BoardCanvas } from "../components/BoardCanvas";
import { Toolbar } from "../components/Toolbar";
import { CursorOverlay } from "../components/CursorOverlay";
import styles from "./BoardPage.module.css";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const hasJoined = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getBoard(boardId!),
    enabled: !!boardId,
  });

  useEffect(() => {
    if (!boardId || hasJoined.current) return;
    hasJoined.current = true;

    const socket = connectSocket();

    socket.on("connect", async () => {
      registerBoardListeners();
      await joinBoard(boardId);
    });

    if (socket.connected) {
      registerBoardListeners();
      joinBoard(boardId);
    }

    return () => {
      leaveBoard(boardId);
      unregisterBoardListeners();
      disconnectSocket();
      hasJoined.current = false;
    };
  }, [boardId]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <span>Loading board...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.error}>
        <span>Board not found</span>
        <button onClick={() => navigate("/")}>Go home</button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate("/")}>
          ← murmur
        </button>
        <span className={styles.boardName}>{data.board.name}</span>
        <div className={styles.headerRight}>
          <span className={styles.role}>{data.role}</span>
        </div>
      </header>

      <div className={styles.canvasWrapper}>
        <Toolbar />
        <BoardCanvas boardId={boardId!} role={data.role} />
        <CursorOverlay />
      </div>
    </div>
  );
}
