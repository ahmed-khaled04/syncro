import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import { socket } from "../config/socket";
import { useRoomLanguage } from "../hooks/useRoomLanguage";
import { useYjsSync } from "../hooks/useYjsSync";
import EditorHeader from "../components/EditorHeader";
import CollabEditor from "../components/CollabEditor";
import FileExplorer from "../components/FileExplorer";
import SnapshotPanel from "../components/SnapshotPanel";

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

  // ✅ fileId, not a filename, and start null (no fake "main")
  const [selectedFileId, setSelectedFileId] = useState(null);

  const ytext = useMemo(() => {
    if (!ydoc || !selectedFileId) return null;
    const files = ydoc.getMap("files");
    return files.get(selectedFileId) || null;
  }, [ydoc, selectedFileId]);

  // ✅ Human-readable filename for header (optional)
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

  // ✅ Auto-select first real file once FS loads / if selection becomes invalid
  useEffect(() => {
    if (!ydoc) return;

    const nodes = ydoc.getMap("fs:nodes");
    const files = ydoc.getMap("files");

    const ensureValidSelection = () => {
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

  // edit requests (owner receives)
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

  // awareness -> keep directory fresh
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
          lang={lang}
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

        <div className="relative mt-2 mb-2">
          <div className="pointer-events-none absolute inset-x-10 -top-2 h-10 rounded-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent blur-2xl" />
          <div className="pointer-events-none mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="h-[520px] lg:h-[620px]">
            <FileExplorer
              ydoc={ydoc}
              socket={socket}
              roomId={roomId}
              canEdit={hasEditAccess}
              selectedFileId={selectedFileId}
              onSelectFile={(fid) => setSelectedFileId(fid)}
            />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-2xl overflow-hidden">
            {ytext ? (
              <CollabEditor
                lang={lang}
                fileId={selectedFileId}
                ytext={ytext}
                awareness={awareness}
                readOnly={readOnly}
              />
            ) : (
              <div className="h-[520px] lg:h-[620px] flex items-center justify-center text-sm text-zinc-400">
                {ydoc ? "Loading file…" : "Joining room…"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
