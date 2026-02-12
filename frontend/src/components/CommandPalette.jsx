import { useEffect, useRef, useState, useMemo } from "react";

export default function CommandPalette({
  isOpen,
  onClose,
  files,
  selectedFileId,
  openFiles,
  onSelectFile,
  onCloseTab,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onExport,
}) {
  const [search, setSearch] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  // Build command list: files + actions
  const commands = useMemo(() => {
    const cmds = [];

    // File search commands
    if (search.trim()) {
      files.forEach((file) => {
        if (
          file.name.toLowerCase().includes(search.toLowerCase()) &&
          file.type === "file"
        ) {
          cmds.push({
            id: `file-${file.fileId}`,
            label: `Open ${file.name}`,
            description: file.name,
            icon: "📄",
            action: () => onSelectFile(file.fileId),
          });
        }
      });
    }

    // Quick actions
    if (!search || "create file".includes(search.toLowerCase())) {
      cmds.push({
        id: "create-file",
        label: "Create File",
        description: "New file in root",
        icon: "➕",
        action: () => {
          onCreateFile("root");
          onClose();
        },
      });
    }

    if (!search || "create folder".includes(search.toLowerCase())) {
      cmds.push({
        id: "create-folder",
        label: "Create Folder",
        description: "New folder in root",
        icon: "📁",
        action: () => {
          onCreateFolder("root");
          onClose();
        },
      });
    }

    if (selectedFileId && (!search || "rename".includes(search.toLowerCase()))) {
      cmds.push({
        id: "rename",
        label: "Rename File",
        description: "Rename current file",
        icon: "✎",
        action: () => {
          const file = files.find((f) => f.fileId === selectedFileId);
          if (file) onRename(selectedFileId, file.name);
          onClose();
        },
      });
    }

    if (selectedFileId && (!search || "delete".includes(search.toLowerCase()))) {
      cmds.push({
        id: "delete",
        label: "Delete File",
        description: "Delete current file",
        icon: "🗑",
        action: () => {
          const file = files.find((f) => f.fileId === selectedFileId);
          if (file) onDelete(selectedFileId, file.name);
          onClose();
        },
      });
    }

    if (openFiles.length > 0 && (!search || "close".includes(search.toLowerCase()))) {
      openFiles.forEach((file) => {
        cmds.push({
          id: `close-${file.fileId}`,
          label: `Close ${file.name}`,
          description: "Close tab",
          icon: "✕",
          action: () => {
            onCloseTab(file.fileId);
            onClose();
          },
        });
      });
    }

    if (!search || "export".includes(search.toLowerCase())) {
      cmds.push({
        id: "export",
        label: "Export Project",
        description: "Download as ZIP",
        icon: "📦",
        action: () => {
          onExport?.();
          onClose();
        },
      });
    }

    return cmds;
  }, [search, files, selectedFileId, openFiles, onSelectFile, onCreateFile, onCreateFolder, onRename, onDelete, onCloseTab, onClose, onExport]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [search]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev + 1) % commands.length || 0);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev - 1 + commands.length) % commands.length || 0);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (commands[selectedIdx]) {
        commands[selectedIdx].action();
      }
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 p-3">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files, commands... (Esc to close)"
            className="w-full bg-transparent text-lg text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {commands.length === 0 ? (
            <div className="p-6 text-center text-zinc-400">No results</div>
          ) : (
            commands.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setSearch("");
                }}
                className={[
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  idx === selectedIdx
                    ? "bg-indigo-500/20 text-indigo-100"
                    : "text-zinc-300 hover:bg-zinc-800/60",
                ].join(" ")}
              >
                <span className="text-lg flex-shrink-0">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cmd.label}</div>
                  <div className="text-xs text-zinc-500">{cmd.description}</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-950/50 p-2 text-xs text-zinc-500 flex justify-end gap-4">
          <span>↑↓ to navigate</span>
          <span>Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
