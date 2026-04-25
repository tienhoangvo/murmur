import { useSelectionStore } from "../store/selectionStore";
import styles from "./Toolbar.module.css";

type Tool =
  | "select"
  | "rect"
  | "square"
  | "ellipse"
  | "circle"
  | "cloud"
  | "arrow"
  | "text"
  | "freehand";

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "rect", label: "Rect", icon: "▭" },
  { id: "square", label: "Square", icon: "▢" },
  { id: "ellipse", label: "Ellipse", icon: "⬭" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "cloud", label: "Cloud", icon: "☁" },
  { id: "arrow", label: "Arrow", icon: "→" },
  { id: "text", label: "Text", icon: "T" },
  { id: "freehand", label: "Freehand", icon: "✏" },
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
          onClick={() => setActiveTool(tool.id as any)}
          title={tool.label}
        >
          <span className={styles.icon}>{tool.icon}</span>
          <span className={styles.label}>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}
