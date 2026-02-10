import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { LANGS } from "../constants/langs";
import OnlineUsers from "./OnlineUsers";

/* ================= Status ================= */

function StatusPill({ connected, synced }) {
  const state = !connected ? "disconnected" : synced ? "live" : "syncing";

  const styles =
    state === "live"
      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
      : state === "syncing"
      ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25"
      : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25";

  const dot =
    state === "live"
      ? "bg-emerald-400"
      : state === "syncing"
      ? "bg-amber-400"
      : "bg-rose-400";

  const label =
    state === "live" ? "Live" : state === "syncing" ? "Syncing…" : "Disconnected";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        styles,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", dot].join(" ")} />
      {label}
    </span>
  );
}

/* ================= Buttons ================= */

function PillButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="
        inline-flex items-center gap-2 rounded-full
        border border-zinc-800 bg-zinc-950/40
        px-3 py-2 text-xs font-semibold text-zinc-200
        transition hover:bg-zinc-800/40 hover:text-white
        focus:outline-none focus:ring-2 focus:ring-indigo-500/20
        active:scale-[0.97]
      "
    >
      {children}
    </button>
  );
}

/* ================= Custom Language Dropdown ================= */

function useOutsideClick(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target)) return;
      handler?.();
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler, enabled]);
}

function LanguageDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = LANGS[value] || LANGS.js;
  const items = useMemo(() => Object.entries(LANGS), []);

  useOutsideClick(rootRef, () => setOpen(false), open);

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative sm:w-56">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          w-full rounded-xl border border-zinc-800
          bg-gradient-to-b from-zinc-950/60 to-zinc-900/30
          px-3 py-2.5 text-left text-sm font-semibold text-zinc-100
          outline-none transition
          hover:border-zinc-700 hover:bg-zinc-900/40
          focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/60
          shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]
          flex items-center justify-between gap-3
        "
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/70 ring-1 ring-zinc-700 text-xs text-zinc-200">
            ⌘
          </span>
          <span className="truncate">{current.label}</span>
        </span>

        <span className="text-zinc-300">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          className="
            absolute right-0 mt-2 w-full z-30
            rounded-2xl border border-zinc-800
            bg-zinc-950/95 backdrop-blur
            shadow-2xl overflow-hidden
          "
          role="listbox"
        >
          <div className="p-2">
            {items.map(([id, info]) => {
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pick(id)}
                  className={[
                    "w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-500/25"
                      : "text-zinc-200 hover:bg-zinc-800/50",
                  ].join(" ")}
                  role="option"
                  aria-selected={active}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        active ? "bg-indigo-400" : "bg-zinc-500",
                      ].join(" ")}
                    />
                    <span className="truncate">{info.label}</span>
                  </span>

                  {active && (
                    <span className="text-xs font-semibold text-indigo-200">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Export helpers ================= */

function getExtension(lang) {
  switch (lang) {
    case "js":
      return "js";
    case "py":
      return "py";
    case "cpp":
      return "cpp";
    case "html":
      return "html";
    default:
      return "txt";
  }
}

function downloadTextFile({ filename, content }) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ================= Header ================= */

export default function EditorHeader({
  roomId,
  connected,
  synced,
  lang,
  onChangeLang,
  awareness,
  ytext, // required for export
}) {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    return () => toastTimer.current && clearTimeout(toastTimer.current);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1200);
  };

  const copyText = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(msg);
      } catch {
        showToast("Copy failed");
      }
    }
  };

  const onCopyAll = useCallback(() => {
    const content = ytext?.toString?.() ?? "";
    if (!content) return showToast("Nothing to copy");
    copyText(content, "Code copied");
  }, [ytext]);

  const onDownload = useCallback(() => {
    const content = ytext?.toString?.() ?? "";
    if (!content) return showToast("Nothing to download");

    const ext = getExtension(lang);
    const filename = `syncro-${roomId}.${ext}`;
    downloadTextFile({ filename, content });
    showToast(`Downloaded .${ext}`);
  }, [ytext, lang, roomId]);

  // ✅ Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMod = e.ctrlKey || e.metaKey; // Ctrl (Win/Linux) or Cmd (Mac)
      if (!isMod) return;

      const key = (e.key || "").toLowerCase();

      // Ctrl/Cmd + S => download
      if (key === "s") {
        e.preventDefault();
        onDownload();
        return;
      }

      // Ctrl/Cmd + Shift + C => copy all
      if (key === "c" && e.shiftKey) {
        e.preventDefault();
        onCopyAll();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onDownload, onCopyAll]);

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="pointer-events-none absolute right-4 top-3 z-40">
          <div className="rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 shadow-lg">
            {toast}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-zinc-700">
            <span className="text-lg">⚡</span>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold tracking-tight">Room</div>
              <StatusPill connected={connected} synced={synced} />
            </div>

            <div className="mt-0.5 font-mono text-xs text-zinc-400">{roomId}</div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PillButton
                onClick={() => copyText(roomId, "Room ID copied")}
                title="Copy Room ID"
              >
                📋 Copy ID
              </PillButton>

              <PillButton
                onClick={() => copyText(window.location.href, "Link copied")}
                title="Copy Share Link"
              >
                🔗 Copy link
              </PillButton>

              <PillButton onClick={onCopyAll} title="Copy all (Ctrl/Cmd+Shift+C)">
                📄 Copy all
              </PillButton>

              <PillButton onClick={onDownload} title="Download (Ctrl/Cmd+S)">
                ⬇ Download
              </PillButton>
            </div>

            <div className="mt-2 text-[11px] text-zinc-500">
              Shortcuts: <span className="text-zinc-400">Ctrl/Cmd + S</span> download ·{" "}
              <span className="text-zinc-400">Ctrl/Cmd + Shift + C</span> copy all
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <OnlineUsers awareness={awareness} />

          <label className="text-xs font-medium text-zinc-400">Language</label>

          <LanguageDropdown value={lang} onChange={onChangeLang} />
        </div>
      </div>
    </div>
  );
}
