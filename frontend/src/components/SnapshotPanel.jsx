import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { diffLines } from "diff";
import {
  ModalShell,
  SecondaryButton,
  DangerButton,
  TextInputModal,
  ConfirmModal,
} from "./DialogComponents";

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

function labelOf(it) {
  if (!it) return "";
  if (it.kind === "current") return "🟣 Current";
  const icon = it.kind === "milestone" ? "📌" : "🕒";
  return `${icon} ${it.label || (it.kind === "milestone" ? "Milestone" : "Auto")}`;
}

function safeLower(s) {
  return String(s || "").toLowerCase();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text ?? "");
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text ?? ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg border px-3 py-2 text-xs font-semibold transition " +
        (active
          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-100"
          : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-800/40")
      }
    >
      {children}
    </button>
  );
}

/* ---------------- Side-by-side diff (virtualized) ---------------- */

function SideBySideDiff({ beforeText, afterText, leftTitle = "LEFT", rightTitle = "RIGHT" }) {
  const rows = useMemo(
    () => buildSideBySideRows(beforeText || "", afterText || ""),
    [beforeText, afterText]
  );

  return (
    <div className="rounded-2xl border border-zinc-800 overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-10">
        <div className="px-4 py-3 text-xs font-semibold text-zinc-400 border-r border-zinc-800">
          {leftTitle}
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-zinc-400">
          {rightTitle}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-sm text-zinc-400">No diff to show.</div>
      ) : (
        <div className="flex-1 min-h-0">
          <Virtuoso
            className="sync-scroll"
            style={{ height: "100%" }}
            data={rows}
            itemContent={(index, r) => (
              <div className="grid grid-cols-2 border-b border-zinc-900/60">
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
            )}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- main component ---------------- */

// ✅ ADDED: fileId prop
export default function SnapshotPanel({
  socket,
  roomId,
  fileId,      // ✅ per-file history key
  ytext,
  youAreOwner,
  ownerId,
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Diff modes:
  // - "single": snapshot vs current editor
  // - "compare": snapshot A vs snapshot B
  // - "compareCurrent": snapshot A vs current
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMode, setDiffMode] = useState("single"); // "single" | "compare" | "compareCurrent"

  const [selected, setSelected] = useState(null);
  const [working, setWorking] = useState(false);

  const [currentContent, setCurrentContent] = useState("");

  // Compare selection
  const [compareAId, setCompareAId] = useState(null);
  const [compareBId, setCompareBId] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  const pendingSingleIdRef = useRef(null);
  const pendingCompareRef = useRef({ a: null, b: null });

  // ✅ per-file cache
  // key = `${roomId}:${fileId}:${id}`
  const cacheRef = useRef(new Map());
  const cacheKey = (id) => `${roomId || ""}:${fileId || ""}:${String(id)}`;

  // dialogs
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneLabel, setMilestoneLabel] = useState("Milestone");
  const [milestoneSaving, setMilestoneSaving] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTargetId, setRestoreTargetId] = useState(null);
  const [restoreWorking, setRestoreWorking] = useState(false);

  // ✅ Toast
  const [toast, setToast] = useState(null); // { title, body }
  const toastTimerRef = useRef(null);
  const showToast = (t) => {
    setToast(t);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  };

  // ✅ Search + Filter state
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all"); // all | milestone | auto

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

  // ✅ IMPORTANT: when file changes, clear compare state + selected to avoid mixing files
  useEffect(() => {
    // file switched -> reset UI state that depends on the file
    setItems([]);
    setSelected(null);
    setDiffOpen(false);

    setCompareAId(null);
    setCompareBId(null);
    setCompareA(null);
    setCompareB(null);
    pendingSingleIdRef.current = null;
    pendingCompareRef.current = { a: null, b: null };

    // Optional: clear cache for old file to save memory
    // (you can comment this out if you want cross-file cache)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, roomId]);

  const refresh = () => {
    if (!socket || !roomId || !fileId) return;
    setLoading(true);
    socket.emit("snapshots:list", { roomId, fileId, limit: 150 });
  };

  useEffect(() => {
    if (!socket) return;

    const onList = ({ roomId: rid, fileId: fid, items: list }) => {
      if (rid !== roomId) return;
      if (fid !== fileId) return;
      setItems(Array.isArray(list) ? list : []);
      setLoading(false);
    };

    const onGet = ({ roomId: rid, fileId: fid, snapshot }) => {
      if (rid !== roomId) return;
      if (fid !== fileId) return;
      if (!snapshot) return;

      cacheRef.current.set(cacheKey(snapshot.id), snapshot);

      if (pendingSingleIdRef.current && pendingSingleIdRef.current === snapshot.id) {
        pendingSingleIdRef.current = null;
        setSelected(snapshot);
        setDiffMode("single");
        setDiffOpen(true);
        setWorking(false);
        return;
      }

      const pend = pendingCompareRef.current;
      if (pend.a && pend.a === snapshot.id) {
        pend.a = null;
        setCompareA(snapshot);
      }
      if (pend.b && pend.b === snapshot.id) {
        pend.b = null;
        setCompareB(snapshot);
      }
      pendingCompareRef.current = pend;

      const aReady = compareAId ? cacheRef.current.get(cacheKey(compareAId)) : null;
      const bReady = compareBId ? cacheRef.current.get(cacheKey(compareBId)) : null;
      if (aReady && bReady) {
        setCompareA(aReady);
        setCompareB(bReady);
        setDiffMode("compare");
        setDiffOpen(true);
      }
    };

    const onRestoreDone = ({ roomId: rid, fileId: fid, restoredId, safetyId }) => {
      if (rid !== roomId) return;
      if (fid !== fileId) return;
      showToast({
        title: "Snapshot restored",
        body: safetyId
          ? `Backup created (#${safetyId}) • Restored (#${restoredId})`
          : `Restored (#${restoredId})`,
      });
      setTimeout(refresh, 250);
    };

    socket.on("snapshots:list:result", onList);
    socket.on("snapshot:get:result", onGet);
    socket.on("snapshot:restore:done", onRestoreDone);

    return () => {
      socket.off("snapshots:list:result", onList);
      socket.off("snapshot:get:result", onGet);
      socket.off("snapshot:restore:done", onRestoreDone);
    };
  }, [socket, roomId, fileId, compareAId, compareBId]);

  useEffect(() => {
    if (!open) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileId]);

  const fetchSnapshot = (id) => {
    if (!socket || !roomId || !fileId) return;
    socket.emit("snapshot:get", { roomId, fileId, id });
  };

  const viewDiff = (id) => {
    if (!socket || !roomId || !fileId) return;

    const cached = cacheRef.current.get(cacheKey(id));
    setWorking(true);
    setDiffMode("single");

    if (cached?.content != null) {
      pendingSingleIdRef.current = null;
      setSelected(cached);
      setDiffOpen(true);
      setWorking(false);
      return;
    }

    pendingSingleIdRef.current = id;
    fetchSnapshot(id);
  };

  const clearCompare = () => {
    setCompareAId(null);
    setCompareBId(null);
    setCompareA(null);
    setCompareB(null);
    pendingCompareRef.current = { a: null, b: null };
  };

  const pickCompare = (id) => {
    if (!socket || !roomId || !fileId) return;

    if (!compareAId) {
      setCompareAId(id);
      const cached = cacheRef.current.get(cacheKey(id));
      if (cached?.content != null) {
        setCompareA(cached);
      } else {
        pendingCompareRef.current = { ...pendingCompareRef.current, a: id };
        fetchSnapshot(id);
      }
      return;
    }

    if (compareAId === id) {
      clearCompare();
      return;
    }

    setCompareBId(id);
    const cachedB = cacheRef.current.get(cacheKey(id));
    if (cachedB?.content != null) {
      setCompareB(cachedB);
      const a = cacheRef.current.get(cacheKey(compareAId));
      if (a?.content != null) {
        setCompareA(a);
        setDiffMode("compare");
        setDiffOpen(true);
      }
    } else {
      pendingCompareRef.current = { ...pendingCompareRef.current, b: id };
      fetchSnapshot(id);
    }
  };

  const compareWithCurrent = () => {
    if (!compareAId) return;
    const a = cacheRef.current.get(cacheKey(compareAId)) || compareA;
    if (!a?.content) return;

    const current = {
      id: "current",
      kind: "current",
      label: "Current",
      created_at: Date.now(),
      content: currentContent || "",
    };

    setCompareA(a);
    setCompareB(current);
    setDiffMode("compareCurrent");
    setDiffOpen(true);
  };

  const openRestoreDialog = (id) => {
    if (!youAreOwner) return;
    setRestoreTargetId(id);
    setRestoreOpen(true);
  };

  const doRestore = async () => {
    if (!socket || !roomId || !fileId || !youAreOwner || !restoreTargetId) return;
    setRestoreWorking(true);

    socket.emit("snapshot:restore", { roomId, fileId, id: restoreTargetId });

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
    if (!socket || !roomId || !fileId || !youAreOwner) return;
    setMilestoneSaving(true);

    socket.emit("snapshot:create", {
      roomId,
      fileId,
      label: milestoneLabel?.trim() || "Milestone",
    });

    setTimeout(() => {
      setMilestoneSaving(false);
      setMilestoneOpen(false);
      refresh();
    }, 250);
  };

  // ✅ Apply search + filter
  const filteredItems = useMemo(() => {
    const q = safeLower(query).trim();

    return (items || []).filter((it) => {
      if (!it) return false;

      if (kindFilter !== "all") {
        if (kindFilter === "milestone" && it.kind !== "milestone") return false;
        if (kindFilter === "auto" && it.kind !== "auto") return false;
      }

      if (!q) return true;

      const hay = [it.id, it.kind, it.label, it.created_by, formatTime(it.created_at)]
        .map((x) => safeLower(x))
        .join(" ");

      return hay.includes(q);
    });
  }, [items, query, kindFilter]);

  // Diff selection
  const diffLeft =
    diffMode === "single" ? (selected?.content || "") : (compareA?.content || "");
  const diffRight =
    diffMode === "single" ? (currentContent || "") : (compareB?.content || "");

  const leftTitle =
    diffMode === "single"
      ? `BEFORE (${labelOf(selected)})`
      : `A (${labelOf(compareA)})`;

  const rightTitle =
    diffMode === "compareCurrent"
      ? `CURRENT`
      : `B (${labelOf(compareB)})`;

  const diffTitle =
    diffMode === "single"
      ? selected
        ? `${labelOf(selected)} → Current`
        : "Snapshot"
      : diffMode === "compareCurrent"
        ? compareA
          ? `Compare: ${labelOf(compareA)} ↔ Current`
          : "Compare"
        : compareA && compareB
          ? `Compare: ${labelOf(compareA)} ↔ ${labelOf(compareB)}`
          : "Compare";

  // ✅ Export helpers for diff (per-file filenames)
  const exportLeft = () => {
    const name =
      diffMode === "single"
        ? `file-${fileId}-snapshot-${selected?.id || "unknown"}`
        : `file-${fileId}-A-${compareA?.id || "unknown"}`;
    downloadTextFile(`${name}.txt`, diffLeft);
    showToast({ title: "Downloaded", body: `${name}.txt` });
  };

  const exportRight = () => {
    const name =
      diffMode === "single"
        ? `file-${fileId}-current`
        : diffMode === "compareCurrent"
          ? `file-${fileId}-current`
          : `file-${fileId}-B-${compareB?.id || "unknown"}`;
    downloadTextFile(`${name}.txt`, diffRight);
    showToast({ title: "Downloaded", body: `${name}.txt` });
  };

  const copyLeft = async () => {
    const ok = await copyToClipboard(diffLeft);
    showToast({
      title: ok ? "Copied" : "Copy failed",
      body: ok ? "LEFT copied to clipboard" : "Browser blocked clipboard",
    });
  };

  const copyRight = async () => {
    const ok = await copyToClipboard(diffRight);
    showToast({
      title: ok ? "Copied" : "Copy failed",
      body: ok ? "RIGHT copied to clipboard" : "Browser blocked clipboard",
    });
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[120] w-[340px]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 backdrop-blur shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-100">{toast.title}</div>
                <div className="mt-1 text-xs text-zinc-400">{toast.body}</div>
              </div>
              <button
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/40"
                onClick={() => setToast(null)}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!fileId}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm font-semibold text-zinc-200
                     hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.98] disabled:opacity-50"
          title={!fileId ? "Select a file first" : "Version history"}
        >
          <span className="text-base">🕘</span>
          History
        </button>

        {youAreOwner && (
          <button
            type="button"
            onClick={openMilestoneDialog}
            disabled={!fileId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm font-semibold text-zinc-200
                       hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-100 transition
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
            title={!fileId ? "Select a file first" : "Create a milestone snapshot"}
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

          <div className="absolute right-0 top-0 h-full w-full sm:w-[580px] bg-zinc-950 border-l border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <div className="text-sm font-semibold">Version history</div>
                <div className="text-xs text-zinc-500">
                  Room #{roomId}{" "}
                  {fileId ? (
                    <>
                      • File <span className="font-mono text-zinc-300">{fileId}</span>
                    </>
                  ) : (
                    <span className="text-rose-200/90">• No file selected</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={!fileId}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition disabled:opacity-50"
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

            <div className="p-4 space-y-3 overflow-auto h-[calc(100%-64px)] sync-scroll">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="text-xs text-zinc-400">
                  Restore is owner-only. Compare: pick A then B (or A → Current).
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Owner: <span className="font-mono text-zinc-300">{ownerId || "unknown"}</span>
                </div>
              </div>

              {!fileId && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-300">
                  Select a file in your explorer to view its history.
                </div>
              )}

              {/* Search + Filter */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/25 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <TextInput
                      value={query}
                      onChange={setQuery}
                      placeholder="Search… (label, kind, id, date)"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs font-semibold text-zinc-400 mr-1">Filter:</div>
                  <Chip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
                    All
                  </Chip>
                  <Chip active={kindFilter === "milestone"} onClick={() => setKindFilter("milestone")}>
                    Milestones
                  </Chip>
                  <Chip active={kindFilter === "auto"} onClick={() => setKindFilter("auto")}>
                    Auto
                  </Chip>

                  <div className="ml-auto text-[11px] text-zinc-500">
                    Showing <span className="text-zinc-200">{filteredItems.length}</span>{" "}
                    / {items.length}
                  </div>
                </div>
              </div>

              {/* Compare selection */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-300">Compare selection</div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      A: <span className="text-zinc-200">{compareAId ? `#${compareAId}` : "—"}</span>{" "}
                      • B: <span className="text-zinc-200">{compareBId ? `#${compareBId}` : "—"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={compareWithCurrent}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition disabled:opacity-50"
                      disabled={!compareAId}
                      title="Compare A with current editor content"
                    >
                      Compare w/ Current
                    </button>

                    <button
                      type="button"
                      onClick={clearCompare}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition disabled:opacity-50"
                      disabled={!compareAId && !compareBId}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {filteredItems.length === 0 && !loading && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-400">
                  No snapshots match your search.
                </div>
              )}

              <div className="space-y-2">
                {filteredItems.map((it) => (
                  <div key={it.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{labelOf(it)}</div>
                        <div className="mt-1 text-xs text-zinc-500">{formatTime(it.created_at)}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => viewDiff(it.id)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition"
                          disabled={!fileId}
                        >
                          {working ? "…" : "Diff"}
                        </button>

                        <button
                          type="button"
                          onClick={() => pickCompare(it.id)}
                          className={
                            "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition " +
                            (compareAId === it.id
                              ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-100"
                              : compareBId === it.id
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                                : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-800/40")
                          }
                          disabled={!fileId}
                        >
                          {!compareAId
                            ? "Compare (A)"
                            : compareAId === it.id
                              ? "A ✓"
                              : !compareBId
                                ? "Compare (B)"
                                : compareBId === it.id
                                  ? "B ✓"
                                  : "Compare"}
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
                    disabled={!fileId}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm font-semibold text-zinc-200
                               hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-100 transition disabled:opacity-50"
                  >
                    📌 Create milestone
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Diff modal */}
      {diffOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{diffTitle}</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                File: <span className="font-mono text-zinc-300">{fileId}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLeft}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
                title="Copy LEFT"
              >
                Copy Left
              </button>
              <button
                type="button"
                onClick={copyRight}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
                title="Copy RIGHT"
              >
                Copy Right
              </button>
              <button
                type="button"
                onClick={exportLeft}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition"
                title="Download LEFT .txt"
              >
                Download Left
              </button>
              <button
                type="button"
                onClick={exportRight}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-100 transition"
                title="Download RIGHT .txt"
              >
                Download Right
              </button>

              {youAreOwner && diffMode === "single" && selected && (
                <DangerButton onClick={() => openRestoreDialog(selected.id)} className="px-3 py-2 text-xs">
                  ⏪ Restore
                </DangerButton>
              )}

              {youAreOwner && (diffMode === "compare" || diffMode === "compareCurrent") && compareA && (
                <DangerButton
                  onClick={() => openRestoreDialog(compareA.id)}
                  className="px-3 py-2 text-xs"
                  title="Restore snapshot A"
                >
                  ⏪ Restore A
                </DangerButton>
              )}

              {youAreOwner && diffMode === "compare" && compareB && compareB.id !== "current" && (
                <DangerButton
                  onClick={() => openRestoreDialog(compareB.id)}
                  className="px-3 py-2 text-xs"
                  title="Restore snapshot B"
                >
                  ⏪ Restore B
                </DangerButton>
              )}

              <SecondaryButton onClick={() => setDiffOpen(false)} className="px-3 py-2 text-xs">
                Close
              </SecondaryButton>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-6">
            <div className="mx-auto w-full max-w-[1400px] h-full">
              <SideBySideDiff
                beforeText={diffLeft}
                afterText={diffRight}
                leftTitle={leftTitle}
                rightTitle={rightTitle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm */}
      {restoreOpen && (
        <ModalShell className="max-w-md">
          <div className="p-5 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">⏪</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-100">Restore this snapshot?</div>
                <div className="mt-1 text-xs text-zinc-500">
                  This will overwrite the current file content for everyone in the room.
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

      {/* Milestone dialog */}
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
