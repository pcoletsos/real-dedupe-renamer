/**
 * Drag-and-drop chip builder for the rename schema.
 *
 * Users can:
 *  - Add components via a dropdown.
 *  - Remove components by clicking ×.
 *  - Reorder components via HTML5 drag-and-drop.
 *  - Navigate chips with Left/Right arrow keys.
 *  - Remove focused chip with Delete or Backspace.
 *  - Duplicate focused chip with Ctrl+D / Cmd+D.
 *  - Edit the separator.
 *  - Edit literal values and sequence pad-width inline.
 *
 * A live preview filename is shown below the chips.
 */

import { useCallback, useRef, useState } from "react";
import type { RenameComponent, RenameComponentKind } from "../types";
import { DEFAULT_RENAME_COMPONENTS } from "../types";
import { buildPreview } from "../utils/renamePreview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenameComponentBuilderProps {
  components: RenameComponent[];
  separator: string;
  onComponentsChange: (components: RenameComponent[]) => void;
  onSeparatorChange: (separator: string) => void;
}

// ---------------------------------------------------------------------------
// Addable component menu options
// ---------------------------------------------------------------------------

const ADD_OPTIONS: Array<{ kind: RenameComponentKind; label: string }> = [
  { kind: "folder_name", label: "Folder name" },
  { kind: "original_stem", label: "Original name" },
  { kind: "date_created", label: "Date (created)" },
  { kind: "date_modified", label: "Date (modified)" },
  { kind: "time_created", label: "Time (created)" },
  { kind: "time_modified", label: "Time (modified)" },
  { kind: "sequence", label: "Sequence number" },
  { kind: "literal", label: "Fixed text\u2026" },
];

const CHIP_LABELS: Record<RenameComponentKind, string> = {
  folder_name: "Folder",
  original_stem: "Name",
  date_created: "DateC",
  date_modified: "DateM",
  time_created: "TimeC",
  time_modified: "TimeM",
  sequence: "Seq",
  literal: "Text",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let _nextId = Date.now();
function nextId() {
  return String(_nextId++);
}

export default function RenameComponentBuilder({
  components,
  separator,
  onComponentsChange,
  onSeparatorChange,
}: RenameComponentBuilderProps) {
  const dragSrcIdx = useRef<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const chipRowRef = useRef<HTMLDivElement>(null);

  // --- mutation helpers ---

  const addComponent = (kind: RenameComponentKind) => {
    const comp: RenameComponent = { id: nextId(), kind };
    if (kind === "sequence") comp.pad_width = 3;
    if (kind === "literal") comp.value = "text";
    onComponentsChange([...components, comp]);
    setShowAdd(false);
  };

  const removeComponent = (id: string) => {
    const idx = components.findIndex((c) => c.id === id);
    const next = components.filter((c) => c.id !== id);
    onComponentsChange(next);
    // Adjust focus after removal.
    if (focusedIndex !== null) {
      if (next.length === 0) {
        setFocusedIndex(null);
      } else if (focusedIndex >= next.length) {
        setFocusedIndex(next.length - 1);
      } else if (idx <= focusedIndex && focusedIndex > 0) {
        setFocusedIndex(focusedIndex - 1);
      }
    }
  };

  const duplicateComponent = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= components.length) return;
      const src = components[idx];
      const dup: RenameComponent = { ...src, id: nextId() };
      const next = [...components];
      next.splice(idx + 1, 0, dup);
      onComponentsChange(next);
      setFocusedIndex(idx + 1);
    },
    [components, onComponentsChange],
  );

  const updateComponent = (id: string, patch: Partial<RenameComponent>) => {
    onComponentsChange(components.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  // --- keyboard navigation ---

  const handleChipRowKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't capture keys when typing in an inline input.
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const len = components.length;
      if (len === 0) return;

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev === null ? 0 : Math.min(prev + 1, len - 1),
          );
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev === null ? len - 1 : Math.max(prev - 1, 0),
          );
          break;
        }
        case "Delete":
        case "Backspace": {
          if (focusedIndex !== null && focusedIndex < len) {
            e.preventDefault();
            removeComponent(components[focusedIndex].id);
          }
          break;
        }
        case "d":
        case "D": {
          if ((e.ctrlKey || e.metaKey) && focusedIndex !== null && focusedIndex < len) {
            e.preventDefault();
            duplicateComponent(focusedIndex);
          }
          break;
        }
        default:
          break;
      }
    },
    [components, focusedIndex, duplicateComponent, removeComponent],
  );

  // --- drag-and-drop ---

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    setFocusedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const src = dragSrcIdx.current;
    if (src === null || src === idx) return;

    const next = [...components];
    const [moved] = next.splice(src, 1);
    next.splice(idx, 0, moved);
    dragSrcIdx.current = idx;
    setFocusedIndex(idx);
    onComponentsChange(next);
  };

  const handleDragEnd = () => {
    dragSrcIdx.current = null;
  };

  // --- live preview ---
  const preview = buildPreview(components, separator);

  return (
    <div className="space-y-3">
      {/* Chip row */}
      <div
        ref={chipRowRef}
        className="flex flex-wrap gap-1.5 items-center min-h-[2.25rem]"
        role="listbox"
        aria-label="Rename components"
        tabIndex={0}
        onKeyDown={handleChipRowKeyDown}
        onFocus={() => {
          if (focusedIndex === null && components.length > 0) {
            setFocusedIndex(0);
          }
        }}
        onBlur={(e) => {
          // Clear focus when leaving the chip row entirely.
          if (!chipRowRef.current?.contains(e.relatedTarget as Node)) {
            setFocusedIndex(null);
          }
        }}
      >
        {components.map((comp, idx) => (
          <Chip
            key={comp.id}
            comp={comp}
            focused={focusedIndex === idx}
            onRemove={() => removeComponent(comp.id)}
            onUpdate={(patch) => updateComponent(comp.id, patch)}
            onFocus={() => setFocusedIndex(idx)}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* Keyboard shortcut hint */}
        {focusedIndex !== null && components.length > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1 whitespace-nowrap">
            \u2190\u2192 move \u00B7 Del remove \u00B7 Ctrl+D duplicate
          </span>
        )}

        {/* Add button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-400 dark:border-gray-500 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            + Add
          </button>
          {showAdd && (
            <div className="absolute z-20 left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-md min-w-[160px]">
              {ADD_OPTIONS.map((opt) => (
                <button
                  key={opt.kind}
                  type="button"
                  onClick={() => addComponent(opt.kind)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Separator input + Reset */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Separator:</label>
        <input
          type="text"
          value={separator}
          onChange={(e) => onSeparatorChange(e.target.value)}
          maxLength={5}
          className="w-16 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => {
            onComponentsChange(
              DEFAULT_RENAME_COMPONENTS.map((c) => ({ ...c, id: nextId() })),
            );
            onSeparatorChange("_");
          }}
          className="ml-auto text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Reset to default
        </button>
      </div>

      {/* Live preview */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Preview:</span>
        <span className="text-xs font-mono text-blue-700 dark:text-blue-300 break-all">{preview}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip sub-component
// ---------------------------------------------------------------------------

interface ChipProps {
  comp: RenameComponent;
  focused: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<RenameComponent>) => void;
  onFocus: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function Chip({ comp, focused, onRemove, onUpdate, onFocus, onDragStart, onDragOver, onDragEnd }: ChipProps) {
  const label = CHIP_LABELS[comp.kind];

  return (
    <div
      draggable
      role="option"
      aria-selected={focused}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onClick={onFocus}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-grab select-none border ${
        focused
          ? "bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100 border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/50 dark:ring-blue-500/50"
          : "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700"
      }`}
    >
      <span className="cursor-grab">\u2807</span>
      <span>{label}</span>

      {/* Inline editable: literal value */}
      {comp.kind === "literal" && (
        <input
          type="text"
          value={comp.value ?? ""}
          onChange={(e) => onUpdate({ value: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="text"
          className="w-20 bg-transparent border-b border-blue-400 dark:border-blue-500 outline-none text-xs px-0.5"
        />
      )}

      {/* Inline editable: sequence pad width */}
      {comp.kind === "sequence" && (
        <input
          type="number"
          value={comp.pad_width ?? 3}
          min={1}
          max={9}
          onChange={(e) => onUpdate({ pad_width: Math.max(1, Math.min(9, Number(e.target.value))) })}
          onClick={(e) => e.stopPropagation()}
          title="Pad width (digits)"
          className="w-8 bg-transparent border-b border-blue-400 dark:border-blue-500 outline-none text-xs text-center px-0.5"
        />
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 text-blue-500 hover:text-red-500 dark:hover:text-red-400 leading-none"
        aria-label={`Remove ${label}`}
      >
        \u00D7
      </button>
    </div>
  );
}
