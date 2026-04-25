import { useBoardStore } from "../store/boardStore";
import { useSelectionStore } from "../store/selectionStore";
import type { CanvasElement } from "@murmur/shared";

export function useSelectedElements(): CanvasElement[] {
  const elements = useBoardStore((s) => s.elements);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  return Array.from(selectedIds)
    .map((id) => elements[id])
    .filter((el): el is CanvasElement => el !== undefined);
}
