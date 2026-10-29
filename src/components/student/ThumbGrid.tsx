// src/components/student/ThumbGrid.tsx — the picked pages as thumbnails: touch drag-reorder (dnd-kit, transform
// only), rotate, remove, per-file progress + Retry. Lazy-loaded by UploadAttempts (only once a page is added), so
// dnd-kit is not in the first paint of /s/:token. Thumbs are memoised: dragging one doesn't re-render the others.

import { memo } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DraftItem } from "@/lib/uploadLink/session";
import { BLACK_BTN } from "@/lib/uploadLink/styles";
import type { UploadTokens } from "./UploadAttempts";

export interface ThumbGridProps {
  items: DraftItem[];
  thumbs: Record<string, string>;
  progress: Record<string, number>;
  failed: Record<string, string>;
  busy: boolean;
  t: UploadTokens;
  onMove: (fromId: string, toId: string) => void;
  onRotate: (it: DraftItem) => void;
  onDelete: (it: DraftItem) => void;
  onRetry: (it: DraftItem) => void;
}

export default function ThumbGrid({ items, thumbs, progress, failed, busy, t, onMove, onRotate, onDelete, onRetry }: ThumbGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onMove(String(e.active.id), String(e.over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="thumbs">
          {items.map((it, i) => (
            <Thumb key={it.id} item={it} index={i} url={thumbs[it.id]} progress={progress[it.id]} error={failed[it.id]}
              busy={busy} t={t} onRotate={onRotate} onDelete={onDelete} onRetry={onRetry} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

const Thumb = memo(function Thumb({ item, index, url, progress, error, busy, t, onRotate, onDelete, onRetry }: {
  item: DraftItem; index: number; url?: string; progress?: number; error?: string; busy: boolean; t: UploadTokens;
  onRotate: (it: DraftItem) => void; onDelete: (it: DraftItem) => void; onRetry: (it: DraftItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: busy });
  return (
    <li ref={setNodeRef} data-testid="thumb" className="relative rounded-lg border overflow-hidden"
      style={{ transform: CSS.Transform.toString(transform), transition, borderColor: error ? "#DC2626" : t.border,
               background: t.surface, zIndex: isDragging ? 10 : undefined, willChange: isDragging ? "transform" : undefined,
               contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}>
      <div className="relative aspect-[3/4] touch-none" {...attributes} {...listeners} aria-label={`Page ${index + 1}`}>
        {url ? <img src={url} alt={`Page ${index + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />
          : <div className="flex h-full flex-col items-center justify-center p-1 text-center text-[10px]" style={{ color: t.textMuted }}>
              <span className="text-2xl">📄</span>
              <span className="line-clamp-2 break-all">{item.name}</span>
              {item.pages > 1 && <b>{item.pages} pages</b>}
            </div>}
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-bold text-white">{index + 1}</span>
        {item.path && <span className="absolute right-1 bottom-1 rounded-full bg-green-600 px-1.5 text-[11px] text-white" aria-label="Uploaded">✓</span>}
        {!item.path && progress != null && progress < 100 && !error && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30 overflow-hidden">
            <div className="h-full w-full origin-left bg-gray-900 transition-transform duration-200" style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
        )}
      </div>
      {item.warning && <p className="bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">⚠️ {item.warning}</p>}
      {error && (
        <div className="bg-red-50 p-1 space-y-1">
          <p className="text-[10px] text-red-700">{error}</p>
          <button type="button" onClick={() => onRetry(item)}
            className={`w-full rounded py-1 text-[11px] font-semibold ${BLACK_BTN}`}>Retry</button>
        </div>
      )}
      <div className="flex border-t" style={{ borderColor: t.border }}>
        <button type="button" onClick={() => onRotate(item)} disabled={busy || !item.mime.startsWith("image/")} aria-label="Rotate 90°"
          className="flex-1 py-2 text-sm active:bg-black/10 disabled:opacity-30" style={{ color: t.textSecondary }}>↻</button>
        <button type="button" onClick={() => onDelete(item)} disabled={busy} aria-label="Remove"
          className="flex-1 py-2 text-sm text-red-600 active:bg-black/10 disabled:opacity-30">✕</button>
      </div>
    </li>
  );
});
