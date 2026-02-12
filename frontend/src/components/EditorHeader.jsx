// (KEEP EVERYTHING YOU ALREADY HAVE ABOVE)
// Replace your current EditorHeader.jsx with this FULL version (same as before + name lookup)

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
    state === "live" ? "bg-emerald-400" : state === "syncing" ? "bg-amber-400" : "bg-rose-400";
  const label = state === "live" ? "Live" : state === "syncing" ? "Syncing…" : "Disconnected";

  return (
    <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", styles].join(" ")}>
      <span className={["h-2 w-2 rounded-full", dot].join(" ")} />
      {label}
    </span>
  );
}

/* ================= Buttons ================= */
function PillButton({ children, onClick, title, disabled = false, tone = "default" }) {
  const toneCls =
    tone === "primary"
      ? "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-100"
      : tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-100"
      : tone === "danger"
      ? "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-100"
      : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/40 text-zinc-200";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.97]",
        toneCls,
        disabled ? "opacity-50 cursor-not-allowed hover:bg-transparent active:scale-100" : "",
      ].join(" ")}
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
                    <span className={["h-2 w-2 rounded-full", active ? "bg-indigo-400" : "bg-zinc-500"].join(" ")} />
                    <span className="truncate">{info.label}</span>
                  </span>
                  {active && <span className="text-xs font-semibold text-indigo-200">Selected</span>}
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
  ytext,

  locked,
  ownerId,
  youAreOwner,

  hasEditAccess,
  allowedEditors = [],
  userDirectory = {},   // ✅ NEW

  editRequests = [],

  onRequestEdit,
  onToggleLock,
  onGrantEdit,
  onRevokeEdit,

  onClearRequest,
  onClearAllRequests,
  onExport,
}) {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

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
      showToast("Copy failed");
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
    downloadTextFile({ filename: `syncro-${roomId}.${ext}`, content });
    showToast(`Downloaded .${ext}`);
  }, [ytext, lang, roomId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const key = (e.key || "").toLowerCase();
      if (key === "s") {
        e.preventDefault();
        onDownload();
      }
      if (key === "c" && e.shiftKey) {
        e.preventDefault();
        onCopyAll();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onDownload, onCopyAll]);

  const isViewerLocked = locked && !youAreOwner && !hasEditAccess;

  const handleRequestEdit = () => {
    onRequestEdit?.();
    showToast("Edit request sent");
  };

  const nameFor = (uid) => userDirectory?.[uid] || "Unknown user";

  return (
    <div className="relative">
      {toast && (
        <div className="pointer-events-none absolute right-4 top-3 z-40">
          <div className="rounded-full bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 shadow-lg">
            {toast}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-zinc-700">
              <span className="text-lg">⚡</span>
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-semibold tracking-tight">Room</div>
                <StatusPill connected={connected} synced={synced} />

                {locked && !hasEditAccess && (
                  <span className="inline-flex items-center rounded-full bg-zinc-800/60 px-3 py-1 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-700">
                    👀 Viewer mode
                  </span>
                )}

                {locked && hasEditAccess && !youAreOwner && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/20">
                    ✅ Allowed editor
                  </span>
                )}

                {youAreOwner && (
                  <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-500/25">
                    👑 Owner
                  </span>
                )}
              </div>

              <div className="mt-0.5 font-mono text-xs text-zinc-400">{roomId}</div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PillButton onClick={() => copyText(roomId, "Room ID copied")} title="Copy Room ID">
                  📋 Copy ID
                </PillButton>

                <PillButton onClick={() => copyText(window.location.href, "Link copied")} title="Copy Share Link">
                  🔗 Copy link
                </PillButton>

                <PillButton onClick={onCopyAll} title="Copy all (Ctrl/Cmd+Shift+C)">
                  📄 Copy all
                </PillButton>

                <PillButton onClick={onDownload} title="Download (Ctrl/Cmd+S)">
                  ⬇ Download
                </PillButton>

                <PillButton onClick={onExport} title="Export project as ZIP">
                  📦 Export
                </PillButton>

                <PillButton
                  disabled={!youAreOwner}
                  onClick={() => onToggleLock?.(!locked)}
                  title={youAreOwner ? "Toggle room lock" : "Only owner can lock/unlock"}
                >
                  {locked ? "🔒 Locked" : "🔓 Unlocked"}
                </PillButton>

                {isViewerLocked && (
                  <PillButton tone="primary" onClick={handleRequestEdit} title="Ask owner for edit access">
                    ✉️ Request edit
                  </PillButton>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <OnlineUsers awareness={awareness} ownerId={ownerId} allowedEditors={allowedEditors} locked={locked} />
          </div>
        </div>

        {/* Owner Panels */}
        {youAreOwner && locked && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {/* Requests */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-100">
                  ✉️ Requests <span className="text-zinc-400">({editRequests.length})</span>
                </div>
                <PillButton tone="danger" onClick={() => onClearAllRequests?.()} title="Clear all requests">
                  ✖ Clear
                </PillButton>
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {editRequests.length === 0 ? (
                  <div className="text-xs text-zinc-500">No requests yet.</div>
                ) : (
                  editRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-zinc-200 truncate">
                          <span className="font-semibold">{r.requester?.name || "Someone"}</span> wants to edit
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          {r.requester?.id || "unknown"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const uid = r.requester?.id;
                            if (!uid) return;
                            onGrantEdit?.(uid);
                            showToast(`Approved: ${r.requester?.name || "user"}`);
                            onClearRequest?.(r.id);
                          }}
                          className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 transition"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => onClearRequest?.(r.id)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Allowed list (✅ now shows names) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="text-sm font-semibold text-zinc-100">
                ✅ Allowed editors <span className="text-zinc-400">({allowedEditors.length})</span>
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {allowedEditors.length === 0 ? (
                  <div className="text-xs text-zinc-500">No one has edit access yet.</div>
                ) : (
                  allowedEditors.map((uid) => (
                    <div
                      key={uid}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-200 truncate">
                          {nameFor(uid)}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          {uid.slice(0, 10)}…
                        </div>
                      </div>

                      <PillButton
                        tone="danger"
                        onClick={() => {
                          onRevokeEdit?.(uid);
                          showToast(`Revoked: ${nameFor(uid)}`);
                        }}
                        title="Revoke edit access"
                      >
                        Revoke
                      </PillButton>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                Room stays locked — only allowlisted users can edit.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
