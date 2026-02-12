import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import { socket } from "../config/socket";
import { useRoomLanguage } from "../hooks/useRoomLanguage";
import { useYjsSync } from "../hooks/useYjsSync";
import { detectLanguageFromFilename } from "../utils/languageDetector";
import { exportProjectAsZip } from "../utils/projectExporter";
import EditorHeader from "../components/EditorHeader";
import CollabEditor from "../components/CollabEditor";
import FileExplorer from "../components/FileExplorer";
import SnapshotPanel from "../components/SnapshotPanel";
import TabsBar from "../components/TabsBar";
import CommandPalette from "../components/CommandPalette";

export default function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const name = location.state?.name;

  if (!name) return <Navigate to="/" replace />;

  const { ydoc, awareness, synced, ready } = useYjsSync(socket, roomId, name);
  const { lang, setRoomLanguage } = useRoomLanguage(socket, roomId, "js");

  const [connected, setConnected] = useState(socket.connected);

  const myUserId = useMemo(() => {
    try {
      return localStorage.getItem("syncro-user-id");
    } catch {
      return null;
    }
  }, []);

  const [locked, setLocked] = useState(false);
  const [ownerId, setOwnerId] = useState(null);
  const [youAreOwner, setYouAreOwner] = useState(false);

  const [allowedEditors, setAllowedEditors] = useState([]);
  const [editRequests, setEditRequests] = useState([]);

  const [userDirectory, setUserDirectory] = useState({});

  // ✅ selection
  const [selectedFileId, setSelectedFileId] = useState(null);

  // ✅ tabs
  const [openFiles, setOpenFiles] = useState([]);

  // ✅ dirty tracking
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const [lastSavedContent, setLastSavedContent] = useState(new Map());

  // ✅ command palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ✅ when user intentionally closes last tab, we "pause" auto-select
  const suppressAutoSelectRef = useRef(false);
  const suppressTimerRef = useRef(null);

  const ytext = useMemo(() => {
    if (!ydoc || !selectedFileId) return null;
    const files = ydoc.getMap("files");
    return files.get(selectedFileId) || null;
  }, [ydoc, selectedFileId]);

  const selectedFileName = useMemo(() => {
    if (!ydoc || !selectedFileId) return null;
    const nodes = ydoc.getMap("fs:nodes");
    for (const [, node] of nodes.entries()) {
      if (node?.get("type") === "file" && node.get("fileId") === selectedFileId) {
        return node.get("name") || selectedFileId;
      }
    }
    return selectedFileId;
  }, [ydoc, selectedFileId]);

  const fileLanguage = useMemo(() => {
    return selectedFileName ? detectLanguageFromFilename(selectedFileName) : "js";
  }, [selectedFileName]);

  // awareness: current viewed file
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField("currentFileId", selectedFileId || null);
  }, [awareness, selectedFileId]);

  // add selected file to tabs
  useEffect(() => {
    if (!selectedFileId || !selectedFileName) return;

    setOpenFiles((prev) => {
      const exists = prev.some((f) => f.fileId === selectedFileId);
      if (exists) return prev;

      return [{ fileId: selectedFileId, name: selectedFileName }, ...prev].slice(0, 10);
    });

    if (ytext) {
      const content = ytext.toString();
      setLastSavedContent((prev) => new Map(prev).set(selectedFileId, content));
    }
  }, [selectedFileId, selectedFileName, ytext]);

  // dirty detection
  useEffect(() => {
    if (!selectedFileId || !ytext) return;

    const currentContent = ytext.toString();
    const savedContent = lastSavedContent.get(selectedFileId);

    if (currentContent !== savedContent) {
      setDirtyFiles((prev) => new Set(prev).add(selectedFileId));
    } else {
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedFileId);
        return next;
      });
    }
  }, [ytext?.length, selectedFileId, lastSavedContent]);

  // ✅ auto-select first file (but NOT if user just closed last tab)
  useEffect(() => {
    if (!ydoc) return;

    const nodes = ydoc.getMap("fs:nodes");
    const files = ydoc.getMap("files");

    const ensureValidSelection = () => {
      // If user intentionally closed last tab, respect that (keep no selection)
      if (suppressAutoSelectRef.current && !selectedFileId) return;

      if (selectedFileId && files.get(selectedFileId)) return;

      for (const [, node] of nodes.entries()) {
        if (node?.get("type") === "file") {
          const fid = node.get("fileId");
          if (fid && files.get(fid)) {
            setSelectedFileId(fid);
            return;
          }
        }
      }

      setSelectedFileId(null);
    };

    ensureValidSelection();
    nodes.observeDeep(ensureValidSelection);
    files.observeDeep(ensureValidSelection);

    return () => {
      nodes.unobserveDeep(ensureValidSelection);
      files.unobserveDeep(ensureValidSelection);
    };
  }, [ydoc, selectedFileId]);

  // lock updates
  useEffect(() => {
    const onRoomLock = ({ roomId: rid, locked: l, ownerId: oid }) => {
      if (rid !== roomId) return;
      setLocked(!!l);
      setOwnerId(oid || null);

      const isOwner = !!oid && !!myUserId && oid === myUserId;
      setYouAreOwner(isOwner);
    };

    socket.on("room-lock", onRoomLock);
    return () => socket.off("room-lock", onRoomLock);
  }, [roomId, myUserId]);

  // allowlist updates
  useEffect(() => {
    const onEditors = ({ roomId: rid, editors }) => {
      if (rid !== roomId) return;
      setAllowedEditors(Array.isArray(editors) ? editors : []);
    };

    socket.on("room-editors", onEditors);
    return () => socket.off("room-editors", onEditors);
  }, [roomId]);

  // edit requests
  useEffect(() => {
    const onEditRequest = (payload) => {
      if (!payload || payload.roomId !== roomId) return;

      setEditRequests((prev) => {
        const id = `${payload.requester?.id || "unknown"}-${payload.at || Date.now()}`;
        if (prev.some((r) => r.id === id)) return prev;
        return [{ id, ...payload }, ...prev].slice(0, 6);
      });

      const rid = payload.requester?.id;
      const rname = payload.requester?.name;
      if (rid && rname) {
        setUserDirectory((d) => (d[rid] ? d : { ...d, [rid]: rname }));
      }
    };

    socket.on("edit-request", onEditRequest);
    return () => socket.off("edit-request", onEditRequest);
  }, [roomId]);

  // awareness directory
  useEffect(() => {
    if (!awareness) return;

    const updateDirectory = () => {
      const next = {};
      for (const [, s] of awareness.getStates()) {
        const u = s?.user;
        if (u?.id && u?.name) next[u.id] = u.name;
      }
      setUserDirectory((prev) => ({ ...prev, ...next }));
    };

    updateDirectory();
    awareness.on("update", updateDirectory);
    awareness.on("change", updateDirectory);
    return () => {
      awareness.off("update", updateDirectory);
      awareness.off("change", updateDirectory);
    };
  }, [awareness]);

  // socket status
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // mark file as saved (you can wire this to snapshot save event later)
  useEffect(() => {
    if (!synced || !selectedFileId || !ytext) return;

    const content = ytext.toString();
    setLastSavedContent((prev) => new Map(prev).set(selectedFileId, content));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(selectedFileId);
      return next;
    });
  }, [synced, selectedFileId, ytext?.length]);

  // Keyboard shortcuts: Ctrl+P or Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Flatten file tree for command palette search
  const allFiles = useMemo(() => {
    if (!ydoc) return [];
    const nodes = ydoc.getMap("fs:nodes");
    if (!nodes) return [];

    const files = [];
    const walk = (node) => {
      if (node?.get("type") === "file") {
        files.push({
          fileId: node.get("fileId"),
          name: node.get("name"),
          type: "file",
        });
      }
    };

    nodes.forEach((node) => {
      walk(node);
    });

    return files;
  }, [ydoc]);

  const handleCloseTab = (fileId) => {
    const newOpenFiles = openFiles.filter((f) => f.fileId !== fileId);
    setOpenFiles(newOpenFiles);

    // clean its dirty marker too
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });

    // If closing selected tab:
    if (fileId === selectedFileId) {
      if (newOpenFiles.length > 0) {
        setSelectedFileId(newOpenFiles[0].fileId);
      } else {
        // ✅ closing last tab -> keep no selection and temporarily suppress auto-select
        setSelectedFileId(null);

        suppressAutoSelectRef.current = true;
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => {
          suppressAutoSelectRef.current = false;
        }, 250); // small window is enough
      }
    }
  };

  const handleCreateFile = (parentId = "root") => {
    const name = prompt("File name:", "newFile.js");
    if (name && name.trim()) {
      socket.emit("fs:create-file", { roomId, parentId, name: name.trim() });
    }
  };

  const handleCreateFolder = (parentId = "root") => {
    const name = prompt("Folder name:", "newFolder");
    if (name && name.trim()) {
      socket.emit("fs:create-folder", { roomId, parentId, name: name.trim() });
    }
  };

  const handleRenameFile = (fileId, currentName) => {
    const newName = prompt("New name:", currentName);
    if (newName && newName.trim() && newName !== currentName) {
      socket.emit("fs:rename", { roomId, nodeId: fileId, name: newName.trim() });
    }
  };

  const handleDeleteFile = (fileId, currentName) => {
    if (confirm(`Delete "${currentName}"?`)) {
      socket.emit("fs:delete", { roomId, nodeId: fileId });
    }
  };

  const handleExportProject = async () => {
    try {
      await exportProjectAsZip(ydoc, roomId);
    } catch (error) {
      alert(`Export failed: ${error.message}`);
      console.error("Export error:", error);
    }
  };

  // cleanup timer
  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
          <p className="text-sm text-zinc-400">Loading collaborative room…</p>
        </div>
      </div>
    );
  }

  const hasEditAccess =
    !locked || youAreOwner || (myUserId && allowedEditors.includes(myUserId));
  const readOnly = !hasEditAccess;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-zinc-400">Syncro</div>
            <div className="text-base font-semibold tracking-tight">
              Collaborative Room{" "}
              <span className="font-mono text-zinc-300">#{roomId}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              You are signed in as{" "}
              <span className="text-zinc-300 font-medium">{name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200
                       hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-100 transition
                       focus:outline-none focus:ring-2 focus:ring-rose-500/20 active:scale-[0.98]"
          >
            <span className="text-base">⟵</span> Leave
          </button>
        </div>

        <EditorHeader
          roomId={roomId}
          connected={connected}
          synced={synced}
          lang={fileLanguage}
          onChangeLang={setRoomLanguage}
          awareness={awareness}
          ytext={ytext}
          locked={locked}
          ownerId={ownerId}
          youAreOwner={youAreOwner}
          hasEditAccess={hasEditAccess}
          allowedEditors={allowedEditors}
          userDirectory={userDirectory}
          editRequests={editRequests}
          onRequestEdit={() => socket.emit("request-edit", { roomId })}
          onToggleLock={(next) => socket.emit("set-room-lock", { roomId, locked: next })}
          onGrantEdit={(userId) => socket.emit("grant-edit", { roomId, userId })}
          onRevokeEdit={(userId) => socket.emit("revoke-edit", { roomId, userId })}
          onClearRequest={(id) => setEditRequests((prev) => prev.filter((r) => r.id !== id))}
          onClearAllRequests={() => setEditRequests([])}
          onExport={handleExportProject}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            Active file:{" "}
            <span className="font-mono text-zinc-300">
              {selectedFileName || "(none)"}
            </span>
          </div>

          <SnapshotPanel
            socket={socket}
            roomId={roomId}
            fileId={selectedFileId}
            ytext={ytext}
            youAreOwner={youAreOwner}
            ownerId={ownerId}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="h-[520px] lg:h-[620px]">
            <FileExplorer
              ydoc={ydoc}
              socket={socket}
              roomId={roomId}
              canEdit={hasEditAccess}
              selectedFileId={selectedFileId}
              onSelectFile={(fid) => {
                // selecting a file re-enables auto-select behavior
                suppressAutoSelectRef.current = false;
                setSelectedFileId(fid);
              }}
              awareness={awareness}
            />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-2xl overflow-hidden flex flex-col">
            <TabsBar
              openFiles={openFiles}
              selectedFileId={selectedFileId}
              onSelectFile={(fid) => {
                suppressAutoSelectRef.current = false;
                setSelectedFileId(fid);
              }}
              onCloseTab={handleCloseTab}
              dirtyFiles={dirtyFiles}
              awareness={awareness}
            />

            <div className="flex-1 overflow-hidden">
              {ytext ? (
                <CollabEditor
                  lang={fileLanguage}
                  fileId={selectedFileId}
                  ytext={ytext}
                  awareness={awareness}
                  readOnly={readOnly}
                />
              ) : (
                <div className="h-[520px] lg:h-[620px] flex items-center justify-center text-sm text-zinc-400">
                  {ydoc ? "Select a file from the explorer…" : "Joining room…"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        files={allFiles}
        selectedFileId={selectedFileId}
        openFiles={openFiles}
        onSelectFile={(fid) => {
          suppressAutoSelectRef.current = false;
          setSelectedFileId(fid);
          setCommandPaletteOpen(false);
        }}
        onCloseTab={handleCloseTab}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onRename={handleRenameFile}
        onDelete={handleDeleteFile}
        onExport={handleExportProject}
      />
    </div>
  );
}
