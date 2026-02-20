import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import { socket } from "../config/socket";
import { useRoomLanguage } from "../hooks/useRoomLanguage";
import { useYjsSync } from "../hooks/useYjsSync";
import { detectLanguageFromFilename } from "../utils/languageDetector";
import { exportProjectAsZip } from "../utils/projectExporter";
import { roomsAPI } from "../api/rooms";
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
  const { user } = useAuth();

  // Use authenticated user's name, fallback to location state for backwards compatibility
  const name = user?.name || location.state?.name;
  // Initialize ownership from API response (single source of truth)
  const [youAreOwner, setYouAreOwner] = useState(location.state?.isOwner || false);

  // All hooks must be called before any conditional returns
  const { ydoc, awareness, synced, ready } = useYjsSync(socket, roomId, name);
  const { setRoomLanguage } = useRoomLanguage(socket, roomId, "js");

  const [connected, setConnected] = useState(socket.connected);

  const myUserId = useMemo(() => {
    try {
      const uid = localStorage.getItem("syncro-user-id");
      console.log(`📌 myUserId from localStorage: "${uid}" (type: ${typeof uid})`);
      return uid;
    } catch {
      return null;
    }
  }, []);

  // Invite UI (Owner only)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState(60); // minutes, 0 = no expiry
  const [invites, setInvites] = useState([]);
  const [latestInviteLink, setLatestInviteLink] = useState("");

  const [joinState, setJoinState] = useState({
    status: "checking", // "checking" | "ok" | "error"
    error: "",
  });


  const [locked, setLocked] = useState(false);
  const [ownerId, setOwnerId] = useState(null);

  const [allowedEditors, setAllowedEditors] = useState([]);
  const [editRequests, setEditRequests] = useState([]);

  const [userDirectory, setUserDirectory] = useState({});

  //  selection
  const [selectedFileId, setSelectedFileId] = useState(null);

  //  tabs
  const [openFiles, setOpenFiles] = useState([]);

  //  dirty tracking
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const [lastSavedContent, setLastSavedContent] = useState(new Map());

  //  command palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  //  snapshot panel modal
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false);

  //  sidebar collapse state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  //  resizable sidebars (VS Code style)
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = Number(localStorage.getItem("syncro-leftWidth"));
    return Number.isFinite(saved) && saved > 0 ? saved : 340;
  });

  //  input modal for creating files/folders
  const [inputModal, setInputModal] = useState({
    isOpen: false,
    type: null, // 'file', 'folder', 'rename'
    placeholder: "",
    defaultValue: "",
    parentId: null,
    nodeId: null,
    inputValue: "",
    error: "",
  });

  //  when user intentionally closes last tab, we "pause" auto-select
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
      if (
        node?.get("type") === "file" &&
        node.get("fileId") === selectedFileId
      ) {
        return node.get("name") || selectedFileId;
      }
    }
    return selectedFileId;
  }, [ydoc, selectedFileId]);

  const fileLanguage = useMemo(() => {
    return selectedFileName ? detectLanguageFromFilename(selectedFileName) : "js";
  }, [selectedFileName]);

  const buildFullInviteLink = (inviteUrl) => {
    // inviteUrl from backend looks like /room/:roomId?invite=...
    return `${window.location.origin}${inviteUrl}`;
  };

  const loadInvites = async () => {
    if (!youAreOwner) return;
    try {
      const items = await roomsAPI.listInvites(roomId);
      setInvites(Array.isArray(items) ? items : []);
    } catch (e) {
      // keep silent or show error
      console.warn("listInvites failed:", e);
    }
  };

  const handleGenerateInvite = async () => {
    setInviteError("");
    setInviteLoading(true);
    try {
      const invite = await roomsAPI.createInvite(roomId, {
        expiresInMinutes: inviteExpiry > 0 ? inviteExpiry : undefined,
      });

      const full = buildFullInviteLink(invite.inviteUrl);
      setLatestInviteLink(full);

      // refresh list
      await loadInvites();

      // auto copy
      try {
        await navigator.clipboard.writeText(full);
      } catch {
        // clipboard may fail (http / permissions) - still show link
      }
    } catch (e) {
      setInviteError(e.message || "Failed to create invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setInviteError("Copy failed (browser blocked clipboard).");
    }
  };

  const handleRevokeInvite = async (token) => {
    setInviteError("");
    setInviteLoading(true);
    try {
      await roomsAPI.revokeInvite(token);
      await loadInvites();
    } catch (e) {
      setInviteError(e.message || "Failed to revoke invite");
    } finally {
      setInviteLoading(false);
    }
  };


  // awareness: current viewed file
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField("currentFileId", selectedFileId || null);
  }, [awareness, selectedFileId]);

  // add selected file to tabs
  useEffect(() => {
    if (!selectedFileId || !selectedFileName) return;

    // Intentionally call setState in effect for tab management
    setOpenFiles((prev) => {
      const exists = prev.some((f) => f.fileId === selectedFileId);
      if (exists) return prev;

      return [{ fileId: selectedFileId, name: selectedFileName }, ...prev].slice(
        0,
        10
      );
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
      // Intentional: update dirty files when content changes
      setDirtyFiles((prev) => new Set(prev).add(selectedFileId));
    } else {
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedFileId);
        return next;
      });
    }
  }, [ytext, selectedFileId, lastSavedContent]);

  //  auto-select first file (but NOT if user just closed last tab)
  useEffect(() => {
    if (!ydoc) return;

    const nodes = ydoc.getMap("fs:nodes");
    const files = ydoc.getMap("files");

    const ensureValidSelection = () => {
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

  // Log ownership status
  useEffect(() => {
    console.log(`👤 Room status: ${youAreOwner ? "✅ You are the owner" : "👥 You are a guest"}`);
  }, [youAreOwner]);

  useEffect(() => {
    if (!youAreOwner) return;
    if (!inviteOpen) return;
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteOpen, youAreOwner, roomId]);

  // lock updates - track locked state and ownerId from socket
  // Ownership (youAreOwner) is determined by API response, not socket
  useEffect(() => {
    const onRoomLock = ({ roomId: rid, locked: l, ownerId: oid }) => {
      if (rid !== roomId) return;
      setLocked(!!l);
      setOwnerId(oid || null);

      // NOTE: youAreOwner is set from API response (location.state) and not overridden here
      // to avoid conflicts between API and socket data
      console.log(`🔍 Socket room-lock: locked=${l}, ownerId=${oid}`);
    };

    socket.on("room-lock", onRoomLock);
    return () => socket.off("room-lock", onRoomLock);
  }, [roomId]);

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
        const id = `${payload.requester?.id || "unknown"}-${payload.at || Date.now()
          }`;
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
    // Set initial socket connection state
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
    // Intentional: mark file as saved when synced
    setLastSavedContent((prev) => new Map(prev).set(selectedFileId, content));
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(selectedFileId);
      return next;
    });
  }, [synced, selectedFileId, ytext]);

  // Keyboard shortcuts: Ctrl+P or Ctrl+K for command palette, Ctrl+H for history
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setSnapshotPanelOpen(true);
      }
      if (e.key === "Escape" && snapshotPanelOpen) {
        setSnapshotPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [snapshotPanelOpen]);

  const inviteToken = useMemo(() => {
    return new URLSearchParams(location.search).get("invite");
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    async function doJoin() {
      // must be logged in (you already redirect if !name, but token matters)
      const token = roomsAPI.getToken?.() || localStorage.getItem("syncro-token");
      if (!token) {
        if (!cancelled) setJoinState({ status: "error", error: "Please log in again." });
        return;
      }

      setJoinState({ status: "checking", error: "" });

      try {
        await roomsAPI.joinRoom(roomId, inviteToken || undefined);

        if (!cancelled) setJoinState({ status: "ok", error: "" });

        if (inviteToken) {
          const params = new URLSearchParams(location.search);
          params.delete("invite");
          navigate(`${location.pathname}${params.toString() ? `?${params}` : ""}`, { replace: true });
        }
      } catch (e) {
        if (!cancelled) setJoinState({ status: "error", error: e.message || "Failed to join room" });
      }
    }

if (roomId) doJoin();

    return () => {
      cancelled = true;
    };
  }, [roomId, inviteToken, navigate, location.pathname, location.search]);

  // Notify friends when user joins a room
  useEffect(() => {
    if (joinState.status !== "ok" || !roomId) return;

    // Get room info and notify friends
    const notifyFriends = async () => {
      try {
        const roomInfo = await roomsAPI.getMyRooms();
        const currentRoom = roomInfo.rooms?.find(r => r.room_id === roomId);
        
        if (currentRoom) {
          socket.emit("friend:room-joined", {
            roomId,
            roomName: currentRoom.name || "Unnamed Room",
            isPublic: currentRoom.is_public !== false,
            ownerId: currentRoom.is_owner ? user?.id : currentRoom.owner_id,
          });
        }
      } catch (e) {
        console.warn("Failed to notify friends about room join:", e);
      }
    };

    notifyFriends();

    // Notify friends when leaving the room
    const handleBeforeUnload = () => {
      socket.emit("friend:room-left");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Emit room-left when component unmounts
      socket.emit("friend:room-left");
    };
  }, [joinState.status, roomId, user?.id]);






  // Flatten file tree for command palette search — kept in sync via observeDeep
  const [allFiles, setAllFiles] = useState([]);

  useEffect(() => {
    if (!ydoc) {
      setAllFiles([]);
      return;
    }

    const nodesMap = ydoc.getMap("fs:nodes");

    const buildFilesList = () => {
      const filesList = [];
      nodesMap.forEach((nodeValue, nodeId) => {
        const type = nodeValue.get("type");
        const name = nodeValue.get("name");
        if (type === "file" && name) {
          filesList.push({
            nodeId,
            fileId: nodeValue.get("fileId"),
            name,
            type: "file",
          });
        }
      });
      setAllFiles(filesList);
    };

    buildFilesList();
    nodesMap.observeDeep(buildFilesList);
    return () => nodesMap.unobserveDeep(buildFilesList);
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
        //  closing last tab -> keep no selection and temporarily suppress auto-select
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
    setInputModal({
      isOpen: true,
      type: "file",
      placeholder: "File name",
      defaultValue: "newFile.js",
      parentId,
      nodeId: null,
      inputValue: "newFile.js",
      error: "",
    });
  };

  const handleCreateFolder = (parentId = "root") => {
    setInputModal({
      isOpen: true,
      type: "folder",
      placeholder: "Folder name",
      defaultValue: "newFolder",
      parentId,
      nodeId: null,
      inputValue: "newFolder",
      error: "",
    });
  };

  const handleRenameFile = (fileId, currentName) => {
    setInputModal({
      isOpen: true,
      type: "rename",
      placeholder: "New name",
      defaultValue: currentName,
      parentId: null,
      nodeId: fileId,
      inputValue: currentName,
      error: "",
    });
  };

  const handleInputConfirm = () => {
    const value = inputModal.inputValue.trim();

    if (!value) {
      setInputModal((prev) => ({ ...prev, error: "Name cannot be empty" }));
      return;
    }

    if (inputModal.type === "file") {
      socket.emit("fs:create-file", { roomId, parentId: inputModal.parentId, name: value });
    } else if (inputModal.type === "folder") {
      socket.emit("fs:create-folder", { roomId, parentId: inputModal.parentId, name: value });
    } else if (inputModal.type === "rename") {
      socket.emit("fs:rename", { roomId, nodeId: inputModal.nodeId, name: value });
    }

    setInputModal({ isOpen: false, type: null, placeholder: "", defaultValue: "", parentId: null, nodeId: null, inputValue: "", error: "" });
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInputConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputModal({ isOpen: false, type: null, placeholder: "", defaultValue: "", parentId: null, nodeId: null, inputValue: "", error: "" });
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

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const startDrag = (side) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = leftWidth;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;

      if (side === "left") {
        const next = clamp(startLeft + dx, 280, 560);
        setLeftWidth(next);
        localStorage.setItem("syncro-leftWidth", String(next));
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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

  if (!name) return <Navigate to="/" replace />;

  if (joinState.status === "checking") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
          <p className="text-sm text-zinc-400">Joining room…</p>
          {inviteToken && (
            <p className="text-xs text-zinc-600 font-mono">
              Using invite token…
            </p>
          )}
        </div>
      </div>
    );
  }

  if (joinState.status === "error") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="text-lg font-semibold">Can’t join room</div>
          <div className="text-sm text-zinc-400 mt-2">{joinState.error}</div>

          <div className="mt-5 flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-100 hover:bg-indigo-500/20"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50 text-zinc-200 hover:bg-zinc-800"
              onClick={() => navigate("/dashboard")}
            >
              Back to dashboard
            </button>
          </div>

          {inviteToken && (
            <div className="mt-4 text-xs text-zinc-500">
              If this invite is single-use, it may already be used or revoked.
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 overflow-hidden flex flex-col">
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Animated gradient background */}
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-[520px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="relative border-b border-zinc-800/50 bg-zinc-950/40 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 gap-6">
          {/* Left */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-all duration-200 text-zinc-400 hover:text-zinc-100"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="text-xs text-zinc-500 tracking-wide">SYNCRO</div>
              <div className="text-sm font-semibold truncate">
                Room <span className="font-mono text-indigo-400">#{roomId}</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-zinc-800">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-xs text-zinc-400">{connected ? "Connected" : "Offline"}</span>
            </div>
          </div>

          {/* Center */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-900/45 border border-zinc-800/40">
            <div className="text-right">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-zinc-500">{synced ? "Synced" : "Syncing..."}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {youAreOwner && (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/20 text-xs text-indigo-200 transition-all duration-200 border border-indigo-500/20"
                title="Generate invite link"
              >
                <span>🔗</span>
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSnapshotPanelOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-zinc-100 transition-all duration-200 border border-zinc-700/50"
              title="Open history (Ctrl+H)"
            >
              <span>📋</span>
              <span className="hidden sm:inline">History</span>
            </button>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-zinc-100 transition-all duration-200 border border-zinc-700/50"
              title="Quick search (Ctrl+P)"
            >
              <span>🔍</span>
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline text-xs text-zinc-500">Ctrl+P</kbd>
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-rose-500/10 rounded-xl transition-all duration-200 text-zinc-400 hover:text-rose-100"
              title="Leave room"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Editor header */}
      <div className="relative border-b border-zinc-800/50 bg-zinc-950/10">
        <div className="px-4 sm:px-6 py-4">
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
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex-1 overflow-hidden">
        <div className="w-full h-full flex overflow-hidden px-4 sm:px-6 py-5 gap-4">
          {/* Left Sidebar (Files) */}
          <div
            className={`flex-shrink-0 border border-zinc-800/40 bg-zinc-900/30 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden flex flex-col rounded-2xl ${sidebarOpen ? "" : "w-0 border-transparent"
              }`}
            style={sidebarOpen ? { width: `${leftWidth}px`, minWidth: `${leftWidth}px` } : { width: 0, minWidth: 0 }}
          >
            <div className="p-5 border-b border-zinc-800/40">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Files
              </h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <FileExplorer
                ydoc={ydoc}
                socket={socket}
                roomId={roomId}
                canEdit={hasEditAccess}
                selectedFileId={selectedFileId}
                onSelectFile={(fid) => {
                  suppressAutoSelectRef.current = false;
                  setSelectedFileId(fid);
                }}
                awareness={awareness}
              />
            </div>
          </div>

          {/* Left Resizer */}
          {sidebarOpen && (
            <div
              onMouseDown={startDrag("left")}
              className="group w-2 cursor-col-resize flex-shrink-0"
              title="Drag to resize"
            >
              <div className="w-[2px] mx-auto h-full rounded-full bg-zinc-800/40 group-hover:bg-indigo-500/50 transition" />
            </div>
          )}

          {/* Center Workspace */}
          <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-950/20 min-w-[420px]">
            {/* Tabs */}
            <div className="border-b border-zinc-800/40 bg-zinc-900/15 backdrop-blur-sm">
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
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden p-6">
              <div className="h-full rounded-2xl border border-zinc-800/40 bg-zinc-900/40 backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col">
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
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-400 p-10">
                      <svg
                        className="w-12 h-12 opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-medium mb-1">
                          {ydoc ? "Select a file from the explorer" : "Joining room…"}
                        </p>
                        <p className="text-xs opacity-75">{ydoc && `or press Ctrl+P to search`}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* History Panel Modal */}
      {snapshotPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSnapshotPanelOpen(false)}
          />

          {/* Slide-in Panel */}
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-l border-zinc-800/50 shadow-2xl flex flex-col" style={{ animation: "slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards" }}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800/50 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">History</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {selectedFileName ? (
                    <>
                      <span className="text-zinc-300 font-mono">{selectedFileName}</span>
                      <span className="text-zinc-600"> • {fileLanguage}</span>
                    </>
                  ) : (
                    "No file selected"
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSnapshotPanelOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <SnapshotPanel
                socket={socket}
                roomId={roomId}
                fileId={selectedFileId}
                ytext={ytext}
                youAreOwner={youAreOwner}
                ownerId={ownerId}
              />
            </div>
          </div>
        </>
      )}

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
        ydoc={ydoc}
      />

      {inviteOpen && youAreOwner && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setInviteOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Invite Links</div>
                  <div className="text-xs text-zinc-500">Create one-time invite links for this room.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Create */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-zinc-300 mb-2">Expiry Time</label>
                      <div className="flex items-center gap-2">
                        {/* Number spinner with up/down controls */}
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            min={0}
                            value={inviteExpiry}
                            onChange={(e) => setInviteExpiry(Math.max(0, Number(e.target.value)))}
                            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-indigo-500 font-medium text-lg text-center"
                            placeholder="60"
                          />
                          {/* Up/Down buttons */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => setInviteExpiry(inviteExpiry + 1)}
                              className="h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-indigo-400 transition-colors"
                              title="Increase"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L10 5.414l-5.293 5.293a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInviteExpiry(Math.max(0, inviteExpiry - 1))}
                              className="h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-indigo-400 transition-colors"
                              title="Decrease"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L10 14.586l5.293-5.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-2">
                        {inviteExpiry === 0 ? "Never expires" : `Expires in ${inviteExpiry} minutes`}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateInvite}
                      disabled={inviteLoading}
                      className="px-4 py-3 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-50 font-medium transition-all whitespace-nowrap"
                    >
                      {inviteLoading ? "Creating..." : "Generate Invite"}
                    </button>
                  </div>

                  {latestInviteLink && (
                    <div className="mt-4">
                      <div className="text-xs text-zinc-400 mb-2">Latest invite link</div>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={latestInviteLink}
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(latestInviteLink)}
                          className="px-3 py-2 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-200"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {inviteError && (
                    <div className="mt-3 text-xs text-rose-300">{inviteError}</div>
                  )}
                </div>

                {/* List */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <div className="text-xs font-semibold text-zinc-300">Invites</div>
                    <button
                      type="button"
                      onClick={loadInvites}
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="max-h-[320px] overflow-auto">
                    {invites.length === 0 ? (
                      <div className="p-4 text-xs text-zinc-500">No invites yet.</div>
                    ) : (
                      <div className="divide-y divide-zinc-800">
                        {invites.map((inv) => {
                          const link = buildFullInviteLink(`/room/${roomId}?invite=${inv.token}`);
                          const used = !!inv.redeemed_at;
                          const revoked = !!inv.revoked;

                          let status = "Active";
                          if (revoked) status = "Revoked";
                          else if (used) status = "Used";

                          return (
                            <div key={inv.id || inv.token} className="p-4 hover:bg-zinc-800/20 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono text-zinc-200 truncate bg-zinc-800/40 px-2 py-1 rounded-lg">
                                      {inv.token}
                                    </span>
                                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${revoked
                                        ? "bg-red-500/10 border-red-500/30 text-red-300"
                                        : used
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                          : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                                      }`}>
                                      {status}
                                    </span>
                                  </div>

                                  <div className="mt-2 flex gap-2 items-center">
                                    <input
                                      readOnly
                                      value={link}
                                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(link)}
                                      className="px-3 py-2 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-200 transition-colors"
                                    >
                                      Copy
                                    </button>
                                  </div>

                                  <div className="mt-3 space-y-1">
                                    {/* Status badge with color coding */}
                                    <div className="flex items-center justify-between">
                                      <div className="text-[11px] text-zinc-500">
                                        {inv.expires_at ? (
                                          (() => {
                                            const expiresDate = new Date(inv.expires_at);
                                            const now = new Date();
                                            const timeLeftMs = expiresDate.getTime() - now.getTime();
                                            const timeLeftMins = Math.floor(timeLeftMs / (1000 * 60));
                                            const isExpired = timeLeftMs <= 0;
                                            const expiresSoon = timeLeftMs > 0 && timeLeftMs <= 3600000; // 1 hour

                                            return (
                                              <span className="flex items-center gap-2">
                                                <span className={isExpired ? "text-red-300" : "text-zinc-400"}>
                                                  {expiresDate.toLocaleString()}
                                                </span>
                                                {isExpired ? (
                                                  <span className="inline-block px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-200 text-[10px] font-medium">
                                                    🔴 Expired
                                                  </span>
                                                ) : expiresSoon ? (
                                                  <span className="inline-block px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-200 text-[10px] font-medium">
                                                    ⚠️ {timeLeftMins}m left
                                                  </span>
                                                ) : null}
                                              </span>
                                            );
                                          })()
                                        ) : (
                                          <span className="text-emerald-300">♾ No expiry</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Redemption status */}
                                    {used && inv.redeemed_at && (
                                      <div className="text-[11px] text-zinc-500">
                                        ✓ Redeemed {new Date(inv.redeemed_at).toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={inviteLoading || revoked}
                                  onClick={() => handleRevokeInvite(inv.token)}
                                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-100 text-xs disabled:opacity-50"
                                >
                                  Revoke
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-800 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}


      {/* Input Modal (File/Folder/Rename) - Rendered as Portal */}
      {inputModal.isOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setInputModal({ ...inputModal, isOpen: false })}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">
                    {inputModal.type === "file" && "New File"}
                    {inputModal.type === "folder" && "New Folder"}
                    {inputModal.type === "rename" && "Rename"}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {inputModal.type === "file" && "Enter the file name (e.g., index.js, styles.css)"}
                    {inputModal.type === "folder" && "Enter the folder name"}
                    {inputModal.type === "rename" && "Enter the new name"}
                  </p>
                </div>

                <input
                  type="text"
                  autoFocus
                  value={inputModal.inputValue}
                  onChange={(e) => setInputModal({ ...inputModal, inputValue: e.target.value, error: "" })}
                  onKeyDown={handleInputKeyDown}
                  placeholder={inputModal.placeholder}
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />

                {inputModal.error && (
                  <p className="text-xs text-red-400 mt-2">{inputModal.error}</p>
                )}

                <p className="text-xs text-zinc-500 mt-3">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Enter</kbd> to confirm or <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">Esc</kbd> to cancel
                </p>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
