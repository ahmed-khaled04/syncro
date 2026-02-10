import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";

function getUserId() {
  let id = localStorage.getItem("syncro-user-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("syncro-user-id", id);
  }
  return id;
}

function colorFromId(id) {
  const palette = [
    "#ef4444", "#f97316", "#eab308",
    "#22c55e", "#06b6d4", "#3b82f6",
    "#8b5cf6", "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function useYjsSync(socket, roomId, name) {
  const [synced, setSynced] = useState(false);
  const [ready, setReady] = useState(false);

  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const awarenessRef = useRef(null);

  const announcedRef = useRef(false);
  const userIdRef = useRef(null);
  const colorRef = useRef(null);

  // INIT (StrictMode-safe). Re-init on room change.
  useEffect(() => {
    announcedRef.current = false;
    setReady(false);

    userIdRef.current = getUserId();
    colorRef.current = colorFromId(userIdRef.current);

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    const awareness = new Awareness(ydoc);

    awareness.setLocalStateField("user", {
      id: userIdRef.current,
      name,
      color: colorRef.current,
    });

    ydocRef.current = ydoc;
    ytextRef.current = ytext;
    awarenessRef.current = awareness;

    setReady(true);

    return () => {
      try { awareness.setLocalState(null); } catch {}
      try { ydoc.destroy?.(); } catch {}

      ydocRef.current = null;
      ytextRef.current = null;
      awarenessRef.current = null;
    };
  }, [roomId, name]);

  const ydoc = ydocRef.current;
  const ytext = ytextRef.current;
  const awareness = awarenessRef.current;

  // JOIN
  useEffect(() => {
    if (!ready) return;

    const onConnect = () => {
      setSynced(false);
      socket.emit("join-room", { roomId, name });
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();
    return () => socket.off("connect", onConnect);
  }, [ready, socket, roomId, name]);

  // FULL SYNC
  useEffect(() => {
    if (!ready || !ydoc) return;

    const onSync = ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
      setSynced(true);
    };

    socket.on("y-sync", onSync);
    return () => socket.off("y-sync", onSync);
  }, [ready, socket, ydoc]);

  // REMOTE DOC UPDATES
  useEffect(() => {
    if (!ready || !ydoc) return;

    const onRemoteUpdate = ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
    };

    socket.on("y-update", onRemoteUpdate);
    return () => socket.off("y-update", onRemoteUpdate);
  }, [ready, socket, ydoc]);

  // LOCAL DOC UPDATES
  useEffect(() => {
    if (!ready || !ydoc) return;

    const onUpdate = (update, origin) => {
      if (!synced || origin === "remote") return;
      socket.emit("y-update", { roomId, update: Array.from(update) });
    };

    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [ready, socket, roomId, ydoc, synced]);

  // AWARENESS SEND (deltas + announce once)
  useEffect(() => {
    if (!ready || !awareness) return;

    const onAwarenessUpdate = ({ added, updated, removed }) => {
      const changed = added.concat(updated, removed);
      if (!changed.length) return;

      const update = encodeAwarenessUpdate(awareness, changed);
      socket.emit("awareness-update", { roomId, update: Array.from(update) });
    };

    awareness.on("update", onAwarenessUpdate);

    // Announce once per room lifecycle (so existing clients see me immediately)
    if (!announcedRef.current) {
      announcedRef.current = true;
      const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
      socket.emit("awareness-update", { roomId, update: Array.from(update) });
    }

    return () => awareness.off("update", onAwarenessUpdate);
  }, [ready, socket, awareness, roomId]);

  // AWARENESS RECEIVE
  useEffect(() => {
    if (!ready || !awareness) return;

    const onAwarenessMessage = ({ update }) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), "remote");
    };

    socket.on("awareness-update", onAwarenessMessage);
    return () => socket.off("awareness-update", onAwarenessMessage);
  }, [ready, socket, awareness]);

  // RESYNC HANDSHAKE
  useEffect(() => {
    if (!ready || !awareness) return;

    const resendAwareness = () => {
      const states = awareness.getStates();
      if (!states.size) return;

      const clientIds = Array.from(states.keys());
      const update = encodeAwarenessUpdate(awareness, clientIds);
      socket.emit("awareness-update", { roomId, update: Array.from(update) });
    };

    socket.on("awareness-resync", resendAwareness);
    return () => socket.off("awareness-resync", resendAwareness);
  }, [ready, socket, awareness, roomId]);

  return { ydoc, ytext, awareness, synced, ready };
}
