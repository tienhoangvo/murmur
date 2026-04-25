import { useSelectionStore } from "../store/selectionStore";
import styles from "./Toolbar.module.css";

type Tool = "select" | "sticky_note" | "text_box" | "shape" | "arrow" | "image";

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "sticky_note", label: "Sticky note", icon: "◻" },
  { id: "text_box", label: "Text", icon: "T" },
  { id: "shape", label: "Shape", icon: "○" },
  { id: "arrow", label: "Arrow", icon: "→" },
];

export function Toolbar() {
  const { activeTool, setActiveTool } = useSelectionStore();

  return (
    <div className={styles.root}>
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`${styles.tool} ${
            activeTool === tool.id ? styles.toolActive : ""
          }`}
          onClick={() => setActiveTool(tool.id)}
          title={tool.label}
        >
          <span className={styles.icon}>{tool.icon}</span>
          <span className={styles.label}>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
