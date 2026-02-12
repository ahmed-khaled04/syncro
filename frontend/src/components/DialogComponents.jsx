import { useState, useRef, useEffect } from "react";

/* ========== Modal Shell ========== */
export function ModalShell({ children, className = "" }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70" />
      <div
        className={
          "relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden " +
          className
        }
      >
        {children}
      </div>
    </div>
  );
}

/* ========== Buttons ========== */
export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
        "bg-indigo-500/15 border border-indigo-500/30 text-indigo-100 " +
        "hover:bg-indigo-500/25 hover:border-indigo-500/45 transition " +
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
        "bg-zinc-900/40 border border-zinc-800 text-zinc-200 " +
        "hover:bg-zinc-800/40 transition " +
        "focus:outline-none focus:ring-2 focus:ring-zinc-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
        "bg-rose-500/12 border border-rose-500/30 text-rose-100 " +
        "hover:bg-rose-500/20 hover:border-rose-500/45 transition " +
        "focus:outline-none focus:ring-2 focus:ring-rose-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed " +
        className
      }
    >
      {children}
    </button>
  );
}

/* ========== Input ========== */
export function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500
                 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40"
      autoFocus
    />
  );
}

/* ========== Text Input Modal Dialog ========== */
export function TextInputModal({
  open,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  dangerous = false,

  // ✅ validation UI
  error = "",
  disableConfirm = false,

  // ✅ NEW: allow parent to validate live
  onValueChange,
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(defaultValue);
    onValueChange?.(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (disableConfirm) return;
    onConfirm?.(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel?.();
    }
  };

  const ButtonComponent = dangerous ? DangerButton : PrimaryButton;

  return (
    <ModalShell className="max-w-md">
      <div className="p-5 border-b border-zinc-800 bg-zinc-950">
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        {description && (
          <div className="mt-1 text-xs text-zinc-500">{description}</div>
        )}
      </div>

      <div className="p-5 space-y-3">
        {label && (
          <div className="text-xs font-semibold text-zinc-300">{label}</div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            onValueChange?.(next); // ✅ live notify
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={[
            "w-full rounded-xl border bg-zinc-900/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500",
            "focus:outline-none focus:ring-2 focus:border-indigo-500/40",
            error ? "border-rose-500/50 focus:ring-rose-500/20" : "border-zinc-800 focus:ring-indigo-500/20",
          ].join(" ")}
        />

        {error ? (
          <div className="text-xs text-rose-300">{error}</div>
        ) : (
          <div className="text-[11px] text-zinc-500">
            Press <span className="text-zinc-300">Enter</span> to confirm,{" "}
            <span className="text-zinc-300">Esc</span> to cancel.
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4">
          <SecondaryButton onClick={onCancel}>{cancelText}</SecondaryButton>
          <ButtonComponent onClick={handleConfirm} disabled={disableConfirm}>
            {confirmText}
          </ButtonComponent>
        </div>
      </div>
    </ModalShell>
  );
}

/* ========== Confirmation Modal ========== */
export function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  dangerous = false,
}) {
  if (!open) return null;

  const ButtonComponent = dangerous ? DangerButton : PrimaryButton;

  return (
    <ModalShell className="max-w-md">
      <div className="p-5 border-b border-zinc-800 bg-zinc-950">
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        {description && (
          <div className="mt-1 text-xs text-zinc-500">{description}</div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-center justify-end gap-2">
          <SecondaryButton onClick={onCancel}>{cancelText}</SecondaryButton>
          <ButtonComponent onClick={onConfirm}>{confirmText}</ButtonComponent>
        </div>
      </div>
    </ModalShell>
  );
}
