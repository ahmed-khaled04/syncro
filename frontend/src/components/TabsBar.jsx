import { useCallback } from "react";
import { useAllFileActivity } from "../hooks/useFileActivity";

export default function TabsBar({
  openFiles,
  selectedFileId,
  onSelectFile,
  onCloseTab,
  dirtyFiles,
  awareness,
}) {
  const allFileActivity = useAllFileActivity(awareness);

  const handleClose = (e, fileId) => {
    e.stopPropagation();
    onCloseTab?.(fileId);
  };

  if (!openFiles || openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto bg-zinc-950 border-b border-zinc-800/50 px-0 py-0 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      {openFiles.map((file) => {
        const isDirty = dirtyFiles?.has(file.fileId);
        const isSelected = file.fileId === selectedFileId;

        return (
          <div
            key={file.fileId}
            className={[
              "inline-flex items-center gap-0 px-3 py-3 text-sm whitespace-nowrap cursor-pointer transition-all relative group",
              isSelected
                ? "bg-zinc-800/80 text-zinc-100 border-b-2 border-indigo-500"
                : "bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/40 border-b-2 border-transparent hover:text-zinc-300",
            ].join(" ")}
          >
            <button
              onClick={() => onSelectFile(file.fileId)}
              className="inline-flex items-center gap-2 focus:outline-none"
              title={file.name}
            >
              <span className="truncate">{file.name}</span>
              {isDirty && <span className="text-amber-400 text-xs">●</span>}
              
              {/* Activity badges */}
              {file.fileId && allFileActivity.has(file.fileId) && (() => {
                const { viewing: v, editing: e } = allFileActivity.get(file.fileId);
                return (v > 0 || e > 0) ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {e > 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30 font-semibold whitespace-nowrap">
                        ✍️ {e}
                      </span>
                    )}
                    {v - e > 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30 font-semibold whitespace-nowrap">
                        👀 {v - e}
                      </span>
                    )}
                  </div>
                ) : null;
              })()}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose(e, file.fileId);
              }}
              className={[
                "ml-2 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 p-0.5 transition focus:outline-none",
                isSelected
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              ].join(" ")}
              title="Close tab"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
