import { useSelectionStore } from "../store/selectionStore";
import { useBoardStore } from "../store/boardStore";
import { useSelectedElements } from "../hooks/useSelectedElements";
import {
  emitUpdateElement,
  emitDeleteElement,
  emitCreateElement,
} from "../socket/boardEvents";
import type {
  CanvasElement,
  StickyNoteElement,
  StickyColor,
} from "@murmur/shared";
import styles from "./ContextToolbar.module.css";

const STICKY_COLORS: { color: StickyColor; value: string }[] = [
  { color: "yellow", value: "hsl(48 95% 76%)" },
  { color: "pink", value: "hsl(340 85% 82%)" },
  { color: "blue", value: "hsl(210 85% 78%)" },
  { color: "green", value: "hsl(152 60% 74%)" },
  { color: "purple", value: "hsl(270 70% 80%)" },
  { color: "orange", value: "hsl(28 90% 74%)" },
];

export function ContextToolbar() {
  const selected = useSelectedElements();
  const { updateElement, removeElement, addElement } = useBoardStore();
  const deselectAll = useSelectionStore((s) => s.deselectAll);
  const select = useSelectionStore((s) => s.select);

  if (selected.length === 0) return <div className={styles.root} />;

  const isSingle = selected.length === 1;
  const el = selected[0]!;
  const isMulti = selected.length > 1;

  function handleDelete() {
    for (const el of selected) {
      removeElement(el.id);
      emitDeleteElement(el.id);
    }
    deselectAll();
  }

  function handleDuplicate() {
    for (const el of selected) {
      const newEl: CanvasElement = {
        ...el,
        id: crypto.randomUUID(),
        x: el.x + 20,
        y: el.y + 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addElement(newEl);
      emitCreateElement(newEl);
      if (isSingle) select(newEl.id);
    }
  }

  function handleLock() {
    for (const el of selected) {
      const locked = !el.locked;
      updateElement({ id: el.id, locked });
      emitUpdateElement({ id: el.id, locked });
    }
  }

  function handleStickyColor(color: StickyColor) {
    if (!isSingle || el.type !== "sticky_note") return;
    updateElement({ id: el.id, color } as any);
    emitUpdateElement({ id: el.id, color } as any);
  }

  function handleFontSize(delta: number) {
    if (!isSingle) return;
    if (el.type !== "sticky_note" && el.type !== "text_box") return;
    const newSize = Math.max(8, Math.min(72, el.fontSize + delta));
    updateElement({ id: el.id, fontSize: newSize } as any);
    emitUpdateElement({ id: el.id, fontSize: newSize } as any);
  }

  function handleAlign(align: "left" | "center" | "right") {
    if (!isSingle || el.type !== "text_box") return;
    updateElement({ id: el.id, align } as any);
    emitUpdateElement({ id: el.id, align } as any);
  }

  function handleFontWeight() {
    if (!isSingle || el.type !== "text_box") return;
    const fontWeight = el.fontWeight === "bold" ? "normal" : "bold";
    updateElement({ id: el.id, fontWeight } as any);
    emitUpdateElement({ id: el.id, fontWeight } as any);
  }

  const isLocked = selected.every((e) => e.locked);

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        {/* sticky note colors */}
        {isSingle && el.type === "sticky_note" && (
          <div className={styles.group}>
            {STICKY_COLORS.map(({ color, value }) => (
              <button
                key={color}
                className={`${styles.colorSwatch} ${
                  (el as StickyNoteElement).color === color
                    ? styles.colorSwatchActive
                    : ""
                }`}
                style={{ background: value }}
                onClick={() => handleStickyColor(color)}
                title={color}
              />
            ))}
          </div>
        )}

        {/* font size */}
        {isSingle && (el.type === "sticky_note" || el.type === "text_box") && (
          <div className={styles.group}>
            <button className={styles.btn} onClick={() => handleFontSize(-2)}>
              A−
            </button>
            <span className={styles.value}>{el.fontSize}px</span>
            <button className={styles.btn} onClick={() => handleFontSize(2)}>
              A+
            </button>
          </div>
        )}

        {/* text box controls */}
        {isSingle && el.type === "text_box" && (
          <div className={styles.group}>
            <button
              className={`${styles.btn} ${
                el.fontWeight === "bold" ? styles.btnActive : ""
              }`}
              onClick={handleFontWeight}
              title="Bold"
            >
              B
            </button>
            <button
              className={`${styles.btn} ${
                el.align === "left" ? styles.btnActive : ""
              }`}
              onClick={() => handleAlign("left")}
              title="Align left"
            >
              ≡
            </button>
            <button
              className={`${styles.btn} ${
                el.align === "center" ? styles.btnActive : ""
              }`}
              onClick={() => handleAlign("center")}
              title="Align center"
            >
              ≡
            </button>
            <button
              className={`${styles.btn} ${
                el.align === "right" ? styles.btnActive : ""
              }`}
              onClick={() => handleAlign("right")}
              title="Align right"
            >
              ≡
            </button>
          </div>
        )}

        {/* z-order */}
        {!isMulti && (
          <div className={styles.group}>
            <button
              className={styles.btn}
              onClick={() => {
                const { elements } = useBoardStore.getState();
                const maxZ = Math.max(
                  ...Object.values(elements).map((e) => e.zIndex),
                );
                updateElement({ id: el.id, zIndex: maxZ + 1 });
                emitUpdateElement({ id: el.id, zIndex: maxZ + 1 });
              }}
              title="Bring to front"
            >
              ↑
            </button>
            <button
              className={styles.btn}
              onClick={() => {
                const { elements } = useBoardStore.getState();
                const minZ = Math.min(
                  ...Object.values(elements).map((e) => e.zIndex),
                );
                updateElement({ id: el.id, zIndex: minZ - 1 });
                emitUpdateElement({ id: el.id, zIndex: minZ - 1 });
              }}
              title="Send to back"
            >
              ↓
            </button>
          </div>
        )}

        <div className={styles.divider} />

        {/* lock */}
        <button
          className={`${styles.btn} ${isLocked ? styles.btnActive : ""}`}
          onClick={handleLock}
          title={isLocked ? "Unlock" : "Lock"}
        >
          {isLocked ? "🔓" : "🔒"}
        </button>

        {/* duplicate */}
        <button
          className={styles.btn}
          onClick={handleDuplicate}
          title="Duplicate"
        >
          ⧉
        </button>

        {/* delete */}
        <button
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={handleDelete}
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
