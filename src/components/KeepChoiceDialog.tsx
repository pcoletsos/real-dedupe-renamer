import { useEffect, useRef, useState } from "react";
import type { DuplicateGroup } from "../types";

interface KeepChoiceDialogProps {
  open: boolean;
  groups: DuplicateGroup[];
  onConfirm: (keepPaths: Map<number, string>) => void;
  onCancel: () => void;
  showFullPaths: boolean;
  onToggleFullPaths: () => void;
}

export default function KeepChoiceDialog({
  open,
  groups,
  onConfirm,
  onCancel,
  showFullPaths,
  onToggleFullPaths,
}: KeepChoiceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // keep index per group: group-index -> file-index (default 0 = newest)
  const [choices, setChoices] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    // Reset choices when dialog opens with new groups
    if (open) {
      const initial = new Map<number, number>();
      groups.forEach((_, gi) => initial.set(gi, 0));
      setChoices(initial);
    }
  }, [open, groups]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  const setChoice = (gi: number, fi: number) => {
    setChoices((prev) => {
      const next = new Map(prev);
      next.set(gi, fi);
      return next;
    });
  };

  const keepNewestAll = () => {
    const next = new Map<number, number>();
    groups.forEach((_, gi) => next.set(gi, 0));
    setChoices(next);
  };

  const handleOk = () => {
    const keepPaths = new Map<number, string>();
    groups.forEach((group, gi) => {
      const fi = choices.get(gi) ?? 0;
      keepPaths.set(gi, group.files[fi].path);
    });
    onConfirm(keepPaths);
  };

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-0 backdrop:bg-black/40 max-w-2xl w-full max-h-[80vh] dark:bg-gray-800"
      onClose={onCancel}
      onCancel={onCancel}
    >
      <div className="p-6 flex flex-col max-h-[80vh]">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Choose files to keep
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select one file to keep per group. All other copies will be deleted.
        </p>

        <label className="flex items-center gap-1.5 text-sm mb-3">
          <input
            type="checkbox"
            checked={showFullPaths}
            onChange={onToggleFullPaths}
            className="rounded"
          />
          Show full path + filename
        </label>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {groups.map((group, gi) => {
            const keepIdx = choices.get(gi) ?? 0;
            return (
              <fieldset
                key={gi}
                className="border border-gray-200 dark:border-gray-700 rounded-md p-3"
              >
                <legend className="text-xs font-medium text-gray-600 dark:text-gray-400 px-1">
                  {group.key_description}
                </legend>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 dark:text-gray-500">
                      <th className="text-left w-16 pb-1">Status</th>
                      <th className="text-left pb-1">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.files.map((file, fi) => {
                      const isKept = fi === keepIdx;
                      const label = showFullPaths
                        ? `${file.path}  (${file.size_human}, modified ${file.mtime_formatted})`
                        : `${file.folder}  (${file.size_human}, modified ${file.mtime_formatted})`;
                      return (
                        <tr key={file.path}>
                          <td className="py-0.5">
                            <span
                              className={`text-xs font-semibold ${
                                isKept ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                              }`}
                            >
                              {isKept ? "KEEP" : "DELETE"}
                            </span>
                          </td>
                          <td className="py-0.5">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`keep-group-${gi}`}
                                checked={isKept}
                                onChange={() => setChoice(gi, fi)}
                              />
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {label}
                              </span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </fieldset>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={keepNewestAll}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Keep newest in all groups
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleOk}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
