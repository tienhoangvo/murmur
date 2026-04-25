import { useSelectionStore, getSelectionState } from "../store/selectionStore";
import { getBoardState } from "../store/boardStore";
import { emitDeleteElement, emitUpdateElement } from "../socket/boardEvents";

export class SelectionManager {
  // delete all selected elements
  deleteSelected() {
    const { selectedIds } = getSelectionState();
    if (selectedIds.size === 0) return;

    for (const id of selectedIds) {
      getBoardState().removeElement(id);
      emitDeleteElement(id);
    }

    useSelectionStore.getState().deselectAll();
  }

  // move selected elements by delta
  moveSelected(dx: number, dy: number) {
    const { selectedIds } = getSelectionState();
    const { elements } = getBoardState();

    for (const id of selectedIds) {
      const el = elements.get(id);
      if (!el || el.locked) continue;

      const newX = el.x + dx;
      const newY = el.y + dy;

      getBoardState().updateElement({ id, x: newX, y: newY });
      emitUpdateElement({ id, x: newX, y: newY });
    }
  }

  // lock/unlock selected elements
  toggleLock() {
    const { selectedIds } = getSelectionState();
    const { elements } = getBoardState();

    for (const id of selectedIds) {
      const el = elements.get(id);
      if (!el) continue;

      const locked = !el.locked;
      getBoardState().updateElement({ id, locked });
      emitUpdateElement({ id, locked });
    }
  }

  // bring selected element to front
  bringToFront() {
    const { selectedIds } = getSelectionState();
    const { elements } = getBoardState();

    const maxZ = Math.max(
      ...Array.from(elements.values()).map((e) => e.zIndex),
    );

    for (const id of selectedIds) {
      const newZ = maxZ + 1;
      getBoardState().reorderElement(id, newZ);
      emitUpdateElement({ id, zIndex: newZ });
    }
  }

  // send selected element to back
  sendToBack() {
    const { selectedIds } = getSelectionState();
    const { elements } = getBoardState();

    const minZ = Math.min(
      ...Array.from(elements.values()).map((e) => e.zIndex),
    );

    for (const id of selectedIds) {
      const newZ = minZ - 1;
      getBoardState().reorderElement(id, newZ);
      emitUpdateElement({ id, zIndex: newZ });
    }
  }

  // select all elements
  selectAll() {
    const { elements } = getBoardState();
    useSelectionStore.getState().selectMany(Array.from(elements.keys()));
  }

  // handle keyboard shortcuts
  handleKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    switch (e.key) {
      case "Delete":
      case "Backspace":
        this.deleteSelected();
        break;
      case "a":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          this.selectAll();
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveSelected(0, e.shiftKey ? -10 : -1);
        break;
      case "ArrowDown":
        e.preventDefault();
        this.moveSelected(0, e.shiftKey ? 10 : 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.moveSelected(e.shiftKey ? -10 : -1, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        this.moveSelected(e.shiftKey ? 10 : 1, 0);
        break;
      case "Escape":
        useSelectionStore.getState().deselectAll();
        break;
    }
  }
}
