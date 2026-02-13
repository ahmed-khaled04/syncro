import { useEffect, useRef, useState, useMemo, useCallback } from "react";

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
  ydoc,
}) {
  const [search, setSearch] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchMode, setSearchMode] = useState("quick"); // "quick" or "content"
  const inputRef = useRef(null);

  // Search through file contents
  const searchFileContents = useCallback((query) => {
    if (!ydoc || !query.trim()) return [];
    
    const results = [];
    const filesMap = ydoc.getMap("files");
    const nodesMap = ydoc.getMap("fs:nodes");
    
    if (!filesMap || !nodesMap) return results;

    const queryLower = query.toLowerCase();
    
    filesMap.forEach((ytext, fileId) => {
      if (!ytext || typeof ytext.toString !== 'function') return;
      
      const content = ytext.toString();
      const lines = content.split('\n');
      
      // Find matching lines
      const matches = [];
      lines.forEach((line, lineNum) => {
        if (line.toLowerCase().includes(queryLower)) {
          matches.push({
            lineNumber: lineNum + 1,
            text: line,
            preview: line.length > 80 ? line.substring(0, 77) + '...' : line,
          });
        }
      });
      
      if (matches.length > 0) {
        // Get file name
        let fileName = fileId;
        for (const [, node] of nodesMap.entries()) {
          if (node?.get("fileId") === fileId) {
            fileName = node.get("name") || fileId;
            break;
          }
        }
        
        results.push({
          fileId,
          fileName,
          matches,
        });
      }
    });
    
    return results;
  }, [ydoc]);

  // Build command list: files + actions + content search
  const commands = useMemo(() => {
    const cmds = [];
    const queryLower = search.toLowerCase().trim();

    // Content search results
    if (queryLower && searchMode === "content") {
      const contentResults = searchFileContents(queryLower);
      if (contentResults.length > 0) {
        cmds.push({
          id: "content-search-header",
          label: `Search Results in ${contentResults.reduce((sum, r) => sum + r.matches.length, 0)} lines`,
          description: `Found in ${contentResults.length} file(s)`,
          icon: "🔍",
          disabled: true,
        });
        
        contentResults.forEach((result) => {
          result.matches.slice(0, 3).forEach((match) => {
            cmds.push({
              id: `content-${result.fileId}-${match.lineNumber}`,
              label: `${result.fileName}:${match.lineNumber}`,
              description: match.preview,
              context: match.text,
              icon: "📍",
              action: () => {
                onSelectFile(result.fileId);
                onClose();
              },
              highlight: queryLower,
            });
          });
          
          if (result.matches.length > 3) {
            cmds.push({
              id: `content-more-${result.fileId}`,
              label: `+${result.matches.length - 3} more matches in ${result.fileName}`,
              description: "Show more results",
              icon: "→",
              action: () => {
                onSelectFile(result.fileId);
                onClose();
              },
            });
          }
        });
      }
    }

    // File name search commands
    if (queryLower && searchMode === "quick") {
      files.forEach((file) => {
        if (
          file.name.toLowerCase().includes(queryLower) &&
          file.type === "file"
        ) {
          cmds.push({
            id: `file-${file.fileId}`,
            label: file.name,
            description: "Open file",
            icon: "📄",
            action: () => onSelectFile(file.fileId),
            highlight: queryLower,
          });
        }
      });
    }
    
    // Quick actions (when in quick mode or no search)
    if (!queryLower || searchMode === "quick") {
      if (!queryLower || "create file".includes(queryLower)) {
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

      if (!queryLower || "create folder".includes(queryLower)) {
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

      if (selectedFileId && (!queryLower || "rename".includes(queryLower))) {
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

      if (selectedFileId && (!queryLower || "delete".includes(queryLower))) {
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

      if (openFiles.length > 0 && (!queryLower || "close".includes(queryLower))) {
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

      if (!queryLower || "export".includes(queryLower)) {
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
    }

    return cmds;
  }, [search, searchMode, files, selectedFileId, openFiles, onSelectFile, onCreateFile, onCreateFolder, onRename, onDelete, onCloseTab, onClose, onExport, searchFileContents]);

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

    // Toggle search mode with Ctrl+Shift+F or Alt+C
    if ((e.ctrlKey || e.altKey) && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      setSearchMode(searchMode === "quick" ? "content" : "quick");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev + 1) % (commands.length || 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev - 1 + (commands.length || 1)) % (commands.length || 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (commands[selectedIdx] && !commands[selectedIdx].disabled) {
        commands[selectedIdx].action?.();
      }
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 p-4">
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchMode === "quick" ? "Search files... (Esc to close)" : "Search file contents... (Esc to close)"}
              className="flex-1 bg-transparent text-lg text-zinc-100 outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => setSearchMode(searchMode === "quick" ? "content" : "quick")}
              title={searchMode === "quick" ? "Search in content (Ctrl+Shift+F)" : "Search in files (Ctrl+Shift+F)"}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                searchMode === "content"
                  ? "bg-indigo-500/20 text-indigo-100 border border-indigo-500/30"
                  : "bg-zinc-800/60 text-zinc-400 border border-zinc-700 hover:bg-zinc-700/60"
              }`}
            >
              {searchMode === "quick" ? "📄 Files" : "🔍 Content"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {commands.length === 0 ? (
            <div className="p-6 text-center text-zinc-400">
              {search.trim() ? "No results found" : "Start typing to search..."}
            </div>
          ) : (
            commands.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action?.();
                  setSearch("");
                }}
                disabled={cmd.disabled}
                className={[
                  "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-800/50 last:border-b-0",
                  cmd.disabled ? "bg-zinc-900/50 pointer-events-none opacity-60" : "",
                  idx === selectedIdx && !cmd.disabled
                    ? "bg-indigo-500/20 text-indigo-100"
                    : "text-zinc-300 hover:bg-zinc-800/60",
                ].join(" ")}
              >
                <span className="text-lg flex-shrink-0 pt-0.5">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex-wrap break-all">
                    {cmd.highlight ? (
                      <>
                        {cmd.label.split(new RegExp(`(${cmd.highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")).map((part, i) =>
                          part.toLowerCase() === cmd.highlight.toLowerCase() ? (
                            <mark key={i} className="bg-yellow-400/30 text-yellow-100 font-semibold">
                              {part}
                            </mark>
                          ) : (
                            part
                          )
                        )}
                      </>
                    ) : (
                      cmd.label
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {cmd.description}
                    {cmd.context && ` — ${cmd.context.substring(0, 60)}${cmd.context.length > 60 ? "..." : ""}`}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-950/50 px-4 py-2 text-xs text-zinc-500 flex justify-between gap-4">
          <div className="flex gap-4">
            <span>↑↓ navigate</span>
            <span>Enter select</span>
            <span>Esc close</span>
          </div>
          <div>
            {searchMode === "quick" ? "Ctrl+Shift+F" : "Ctrl+Shift+F"} to toggle search mode
          </div>
        </div>
      </div>
    </div>
  );}