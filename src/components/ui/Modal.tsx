"use client";

import { X } from "lucide-react";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  loading?: boolean;
  confirmVariant?: "primary" | "danger" | "success";
};

export function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  loading,
  confirmVariant = "danger",
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="surface-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-2xl transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>
        {children}
        {onConfirm && (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant={confirmVariant === "danger" ? "danger" : confirmVariant === "success" ? "success" : "primary"} type="button" onClick={onConfirm} disabled={loading}>
              {loading ? "..." : confirmLabel ?? "Confirm"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
