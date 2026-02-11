import { useEffect, useMemo, useState } from "react";
import { diffLines } from "diff";

/* ---------------- helpers ---------------- */

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts || "");
  }
}

function splitLinesPreserve(text) {
  if (!text) return [];
  return text.split("\n");
}

function buildSideBySideRows(beforeText, afterText) {
  const parts = diffLines(beforeText || "", afterText || "");
  let leftNo = 1;
  let rightNo = 1;

  const rows = [];

  for (const part of parts) {
    const lines = splitLinesPreserve(part.value);
    const effectiveLines = lines.length === 1 && lines[0] === "" ? [] : lines;

    if (part.added) {
      for (const line of effectiveLines) {
        rows.push({
          left: { no: "", text: "", type: "empty" },
          right: { no: rightNo++, text: line, type: "added" },
        });
      }
    } else if (part.removed) {
      for (const line of effectiveLines) {
        rows.push({
          left: { no: leftNo++, text: line, type: "removed" },
          right: { no: "", text: "", type: "empty" },
        });
      }
    } else {
      for (const line of effectiveLines) {
        rows.push({
          left: { no: leftNo++, text: line, type: "same" },
          right: { no: rightNo++, text: line, type: "same" },
        });
      }
    }
  }

  return rows;
}

function cellClasses(type) {
  if (type === "added") return "bg-emerald-500/10 text-emerald-200";
  if (type === "removed") return "bg-rose-500/10 text-rose-200";
  if (type === "empty") return "bg-zinc-900/10 text-zinc-600";
  return "bg-transparent text-zinc-200";
}

/* ---------------- UI building blocks ---------------- */

function Backdrop({ onClick }) {
  return <div className="fixed inset-0 bg-black/70" onClick={onClick} />;
}

function ModalShell({ children, className = "" }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <Backdrop onClick={() => {}} />
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

function PrimaryButton({ children, className = "", ...props }) {
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

function SecondaryButton({ children, className = "", ...props }) {
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

function DangerButton({ children, className = "", ...props }) {
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

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500
                 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40"
    />
  );
}

/* ---------------- Side-by-side diff ---------------- */

function SideBySideDiff({ beforeText, afterText }) {
  const rows = useMemo(
    () => buildSideBySideRows(beforeText || "", afterText || ""),
    [beforeText, afterText]
  );

  return (
    <div className="rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-10">
        <div className="px-4 py-3 text-xs font-semibold text-zinc-400 border-r border-zinc-800">
          BEFORE (snapshot)
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-zinc-400">
          AFTER (current editor)
        </div>
      </div>

      <div className="divide-y divide-zinc-900/60">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-zinc-400">No diff to show.</div>
        ) : (
          rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-2">
              <div className="flex border-r border-zinc-800">
                <div className="w-14 shrink-0 select-none text-right pr-3 py-1.5 text-[11px] text-zinc-500 bg-zinc-950/60 border-r border-zinc-800">
                  {r.left.no}
                </div>
                <pre
                  className={`flex-1 py-1.5 px-3 text-xs font-mono whitespace-pre-wrap break-words ${cellClasses(
                    r.left.type
                  )}`}
                >
                  {r.left.text}
                </pre>
              </div>

              <div className="flex">
                <div className="w-14 shrink-0 select-none text-right pr-3 py-1.5 text-[11px] text-zinc-500 bg-zinc-950/60 border-r border-zinc-800">
                  {r.right.no}
                </div>
                <pre
                  className={`flex-1 py-1.5 px-3 text-xs font-mono whitespace-pre-wrap break-words ${cellClasses(
                    r.right.type
                  )}`}
                >
                  {r.right.text}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- main component ---------------- */

export default function SnapshotPanel({ socket, roomId, ytext, youAreOwner, ownerId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [diffOpen, setDiffOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [working, setWorking] = useState(false);

  const [currentContent, setCurrentContent] = useState("");

  // Modern dialogs (replace window.prompt / window.confirm)
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneLabel, setMilestoneLabel] = useState("Milestone");
  const [milestoneSaving, setMilestoneSaving] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState(null);
  const [restoreWorking, setRestoreWorking] = useState(false);

  // Keep currentContent synced with Yjs
  useEffect(() => {
    if (!ytext) {
      setCurrentContent("");
      return;
    }

    const update = () => {
      try {
        setCurrentContent(ytext.toString());
      } catch {
        setCurrentContent("");
      }
    };

    update();
    ytext.observe(update);

    return () => {
      try {
        ytext.unobserve(update);
      } catch {}
    };
  }, [ytext]);

  const refresh = () => {
    if (!socket || !roomId) return;
    setLoading(true);
    socket.emit("snapshots:list", { roomId, limit: 50 });
  };

  useEffect(() => {
    if (!socket) return;

    const onList = ({ roomId: rid, items: list }) => {
      if (rid !== roomId) return;
      setItems(Array.isArray(list) ? list : []);
      setLoading(false);
    };

    const onGet = ({ roomId: rid, snapshot }) => {
      if (rid !== roomId) return;
      if (!snapshot) return;
      setSelected(snapshot);
      setDiffOpen(true);
      setWorking(false);
    };

    socket.on("snapshots:list:result", onList);
    socket.on("snapshot:get:result", onGet);

    return () => {
      socket.off("snapshots:list:result", onList);
      socket.off("snapshot:get:result", onGet);
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!open) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const viewDiff = (id) => {
    if (!socket || !roomId) return;
    setWorking(true);
    socket.emit("snapshot:get", { roomId, id });
  };

  const openRestoreDialog = (id) => {
    if (!youAreOwner) return;
    setRestoreTargetId(id);
    setRestoreOpen(true);
  };

  const doRestore = async () => {
    if (!socket || !roomId || !youAreOwner || !restoreTargetId) return;
    setRestoreWorking(true);

    socket.emit("snapshot:restore", { roomId, id: restoreTargetId });

    // close dialogs
    setRestoreOpen(false);
    setRestoreTargetId(null);
    setDiffOpen(false);

    setTimeout(() => {
      refresh();
      setRestoreWorking(false);
    }, 350);
  };

  const openMilestoneDialog = () => {
    if (!youAreOwner) return;
    setMilestoneLabel("Milestone");
    setMilestoneOpen(true);
  };

  const doCreateMilestone = async () => {
    if (!socket || !roomId || !youAreOwner) return;
    setMilestoneSaving(true);

    socket.emit("snapshot:create", { roomId, label: milestoneLabel?.trim() || "Milestone" });

    setTimeout(() => {
      setMilestoneSaving(false);
      setMilestoneOpen(false);
      refresh();
    }, 250);
  };

  return (
    <>
      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm font-semibold text-zinc-200
                     hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.98]"
          title="Version history"
        >
          <span className="text-base">🕘</span>
          History
        </button>

        {youAreOwner && (
          <button
            type="button"
            onClick={openMilestoneDialog}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm font-semibold text-zinc-200
                       hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-100 transition
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:scale-[0.98]"
            title="Create a milestone snapshot"
          >
            <span className="text-base">📌</span>
            Milestone
          </button>
        )}
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950 border-l border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <div className="text-sm font-semibold">Version history</div>
                <div className="text-xs text-zinc-500">Room #{roomId}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
                >
                  {loading ? "Loading…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3 overflow-auto h-[calc(100%-64px)]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="text-xs text-zinc-400">
                  Restore is owner-only (available inside Diff view).
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Owner: <span className="font-mono text-zinc-300">{ownerId || "unknown"}</span>
                </div>
              </div>

              {items.length === 0 && !loading && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-400">
                  No snapshots yet.
                  <div className="mt-1 text-xs text-zinc-500">
                    Auto snapshots are created every few minutes when content changes.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {it.kind === "milestone" ? "📌" : "🕒"}{" "}
                          {it.label || (it.kind === "milestone" ? "Milestone" : "Auto")}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{formatTime(it.created_at)}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => viewDiff(it.id)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition"
                        >
                          {working ? "…" : "Diff"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {youAreOwner && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={openMilestoneDialog}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm font-semibold text-zinc-200
                               hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-100 transition"
                  >
                    📌 Create milestone
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Diff modal (side-by-side + line numbers + restore) */}
      {diffOpen && selected && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {selected.kind === "milestone" ? "📌" : "🕒"} {selected.label || "Snapshot"}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{formatTime(selected.created_at)}</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/30 px-2 py-1 text-zinc-300">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400/70" /> added
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/30 px-2 py-1 text-zinc-300">
                  <span className="inline-block h-2 w-2 rounded-sm bg-rose-400/70" /> removed
                </span>
              </div>

              {youAreOwner && (
                <DangerButton onClick={() => openRestoreDialog(selected.id)} title="Restore this snapshot">
                  ⏪ Restore
                </DangerButton>
              )}

              <SecondaryButton onClick={() => setDiffOpen(false)}>Close</SecondaryButton>
            </div>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-auto p-6">
            <div className="mx-auto w-full max-w-[1400px]">
              <SideBySideDiff beforeText={selected.content || ""} afterText={currentContent || ""} />
            </div>
          </div>
        </div>
      )}

      {/* Modern Restore Confirm dialog */}
      {restoreOpen && (
        <ModalShell className="max-w-md">
          <div className="p-5 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">⏪</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-100">Restore this snapshot?</div>
                <div className="mt-1 text-xs text-zinc-500">
                  This will overwrite the current editor content for everyone in the room.
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
              <div className="text-xs font-semibold text-rose-200">Warning</div>
              <div className="mt-1 text-xs text-zinc-400">
                This action can’t be undone (but you can restore another snapshot later).
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <SecondaryButton
                onClick={() => {
                  if (restoreWorking) return;
                  setRestoreOpen(false);
                  setRestoreTargetId(null);
                }}
              >
                Cancel
              </SecondaryButton>
              <DangerButton onClick={doRestore} disabled={restoreWorking}>
                {restoreWorking ? "Restoring…" : "Restore now"}
              </DangerButton>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modern Milestone dialog */}
      {milestoneOpen && (
        <ModalShell className="max-w-md">
          <div className="p-5 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">📌</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-100">Create milestone snapshot</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Give it a label so it’s easy to find later.
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-300">Label</div>
              <TextInput
                value={milestoneLabel}
                onChange={setMilestoneLabel}
                placeholder="e.g. Before refactor / v1 / lecture notes"
              />
              <div className="text-[11px] text-zinc-500">
                Tip: keep it short. You can always create more milestones.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <SecondaryButton
                onClick={() => {
                  if (milestoneSaving) return;
                  setMilestoneOpen(false);
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={doCreateMilestone} disabled={milestoneSaving}>
                {milestoneSaving ? "Saving…" : "Create milestone"}
              </PrimaryButton>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
