import { usePresenceStore } from "../store/presenceStore";
import { useViewportStore } from "../store/viewportStore";
import { worldToScreen } from "../store/viewportStore";
import styles from "./CursorOverlay.module.css";

export function CursorOverlay() {
  const members = usePresenceStore((s) => s.members);
  const x = useViewportStore((s) => s.x);
  const y = useViewportStore((s) => s.y);
  const scale = useViewportStore((s) => s.scale);
  const viewport = { x, y, scale };

  return (
    <div className={styles.root}>
      {Object.values(members).map((member) => {
        if (!member.cursor) return null;

        const screen = worldToScreen(
          member.cursor.x,
          member.cursor.y,
          viewport,
        );

        return (
          <div
            key={member.userId}
            className={styles.cursor}
            style={{
              transform: `translate(${screen.x}px, ${screen.y}px)`,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className={styles.cursorIcon}
            >
              <path
                d="M0 0L0 14L4 10L7 16L9 15L6 9L11 9Z"
                fill={member.avatarColor}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className={styles.label}
              style={{ background: member.avatarColor }}
            >
              {member.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
