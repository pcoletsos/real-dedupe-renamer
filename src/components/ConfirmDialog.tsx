import { useEffect, useRef } from "react";

export interface DialogButton {
  label: string;
  onClick: () => void;
  variant?: "danger" | "primary" | "default";
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  buttons: DialogButton[];
  onClose?: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  buttons,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg shadow-xl border border-gray-200 p-0 backdrop:bg-black/40 max-w-lg w-full"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              className={
                btn.variant === "danger"
                  ? "px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-800 hover:bg-red-200"
                  : btn.variant === "primary"
                    ? "px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    : "px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
