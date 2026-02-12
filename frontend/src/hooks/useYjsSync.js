import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";

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
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function useYjsSync(socket, roomId, name) {
  const [synced, setSynced] = useState(false);
  const [ready, setReady] = useState(false);

  const ydocRef = useRef(null);
  const awarenessRef = useRef(null);

  const userIdRef = useRef(null);
  const colorRef = useRef(null);
  const announcedRef = useRef(false);

  // ✅ buffer any local edits before first y-sync
  const pendingUpdatesRef = useRef([]);

  // Create doc per room
  useEffect(() => {
    announcedRef.current = false;
    pendingUpdatesRef.current = [];
    setSynced(false);
    setReady(false);

    userIdRef.current = getUserId();
    colorRef.current = colorFromId(userIdRef.current);

    const ydoc = new Y.Doc();
    // ensure maps exist; server snapshot will populate them
    ydoc.getMap("fs:nodes");
    ydoc.getMap("files");

    const awareness = new Awareness(ydoc);
    awareness.setLocalStateField("user", {
      id: userIdRef.current,
      name,
      color: colorRef.current,
    });

    ydocRef.current = ydoc;
    awarenessRef.current = awareness;
    setReady(true);

    return () => {
      try {
        awareness.setLocalState(null);
      } catch {}
      try {
        ydoc.destroy?.();
      } catch {}
      ydocRef.current = null;
      awarenessRef.current = null;
    };
  }, [roomId, name]);

  const ydoc = ydocRef.current;
  const awareness = awarenessRef.current;

  /**
   * ✅ IMPORTANT:
   * Register listeners FIRST, then join-room.
   * This fixes the "missed initial y-sync" bug.
   */
  useEffect(() => {
    if (!ready || !ydoc || !awareness) return;

    setSynced(false);
    pendingUpdatesRef.current = [];

    const handleSync = ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
      setSynced(true);

      // flush buffered edits
      const pending = pendingUpdatesRef.current;
      if (pending.length) {
        for (const u of pending) {
          socket.emit("y-update", { roomId, update: Array.from(u) });
        }
        pendingUpdatesRef.current = [];
      }
    };

    const handleRemoteUpdate = ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
    };

    const handleAwarenessMessage = ({ update }) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), "remote");
    };

    const handleAwarenessResync = () => {
      const states = awareness.getStates();
      if (!states.size) return;

      const clientIds = Array.from(states.keys());
      const update = encodeAwarenessUpdate(awareness, clientIds);
      socket.emit("awareness-update", { roomId, update: Array.from(update) });
    };

    // ✅ attach listeners before joining
    socket.on("y-sync", handleSync);
    socket.on("y-update", handleRemoteUpdate);
    socket.on("awareness-update", handleAwarenessMessage);
    socket.on("awareness-resync", handleAwarenessResync);

    const joinNow = () => {
      setSynced(false);
      pendingUpdatesRef.current = [];
      socket.emit("join-room", { roomId, name, userId: userIdRef.current });
    };

    socket.on("connect", joinNow);
    if (socket.connected) joinNow();

    return () => {
      socket.off("y-sync", handleSync);
      socket.off("y-update", handleRemoteUpdate);
      socket.off("awareness-update", handleAwarenessMessage);
      socket.off("awareness-resync", handleAwarenessResync);
      socket.off("connect", joinNow);
    };
  }, [ready, socket, roomId, name, ydoc, awareness]);

  // Local updates => emit (or buffer until synced)
  useEffect(() => {
    if (!ready || !ydoc) return;

    const onUpdate = (update, origin) => {
      if (origin === "remote") return;

      if (!synced) {
        pendingUpdatesRef.current.push(update);
        return;
      }

      socket.emit("y-update", { roomId, update: Array.from(update) });
    };

    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [ready, ydoc, socket, roomId, synced]);

  // Awareness send
  useEffect(() => {
    if (!ready || !awareness) return;

    const onAwarenessUpdate = ({ added, updated, removed }) => {
      const changed = added.concat(updated, removed);
      if (!changed.length) return;

      const update = encodeAwarenessUpdate(awareness, changed);
      socket.emit("awareness-update", { roomId, update: Array.from(update) });
    };

    awareness.on("update", onAwarenessUpdate);

    if (!announcedRef.current) {
      announcedRef.current = true;
      const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
      socket.emit("awareness-update", { roomId, update: Array.from(update) });
    }

    return () => awareness.off("update", onAwarenessUpdate);
  }, [ready, awareness, socket, roomId]);

  return { ydoc, awareness, synced, ready };
}
