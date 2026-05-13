import { ref, type Ref } from 'vue';

interface SortableItem {
  id: string;
}

/**
 * Headless composable for handling drag-and-drop reordering logic.
 * Supports both HTML5 Drag API (Desktop) and ElementFromPoint logic (Mobile).
 */
export function useSortableList<T extends SortableItem>(
  items: Ref<T[]>,
  onReorder: (newOrderIds: string[]) => void | Promise<void>
) {
  const draggingId = ref<string | null>(null);
  const dragOverId = ref<string | null>(null);
  const isDragging = ref(false);

  const onDragStart = (e: DragEvent, id: string) => {
    draggingId.value = id;
    isDragging.value = true;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  };

  const onDragOver = (e: DragEvent, id: string) => {
    e.preventDefault(); // Required for drop to work
    if (draggingId.value && draggingId.value !== id) {
      dragOverId.value = id;
    }
  };

  const onDrop = async (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId.value || draggingId.value === targetId) return;
    
    applyOrderChange(draggingId.value, targetId);
    onDragEnd();
  };

  const onDragEnd = () => {
    draggingId.value = null;
    dragOverId.value = null;
    isDragging.value = false;
  };

  const applyOrderChange = (fromId: string, toId: string) => {
    const fromIdx = items.value.findIndex(i => i.id === fromId);
    const toIdx = items.value.findIndex(i => i.id === toId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newList = [...items.value];
      const moved = newList.splice(fromIdx, 1)[0];
      if (moved) {
        newList.splice(toIdx, 0, moved);
        items.value = newList;
        onReorder(newList.map(i => i.id));
      }
    }
  };

  /**
   * Touch support for mobile devices using a "grip" handle.
   */
  const onGripTouchStart = (e: TouchEvent, id: string, rowSelector: string) => {
    draggingId.value = id;
    isDragging.value = true;

    const onTouchMove = (ev: TouchEvent) => {
      // Prevent scrolling while dragging
      ev.preventDefault();
      
      const touch = ev.touches[0];
      if (!touch) return;
      
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = el?.closest(rowSelector) as HTMLElement | null;
      
      if (row) {
        // Look for either data-bucket-id or data-habit-id
        const targetId = row.dataset.bucketId || row.dataset.habitId;
        if (targetId && targetId !== draggingId.value) {
          dragOverId.value = targetId;
        }
      }
    };

    const onTouchEnd = () => {
      if (draggingId.value && dragOverId.value && draggingId.value !== dragOverId.value) {
        applyOrderChange(draggingId.value, dragOverId.value);
      }
      onDragEnd();
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  };

  return {
    draggingId,
    dragOverId,
    isDragging,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onGripTouchStart
  };
}
