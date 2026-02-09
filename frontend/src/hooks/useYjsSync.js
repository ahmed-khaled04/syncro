import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

export function useYjsSync(socket, roomId, name) {
  const [synced, setSynced] = useState(false);

  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const awarenessRef = useRef(null);

  if (!ydocRef.current) {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    const awareness = new Awareness(ydoc);
    awareness.setLocalStateField("user", { name });

    ydocRef.current = ydoc;
    ytextRef.current = ytext;
    awarenessRef.current = awareness;
  }

  const ydoc = ydocRef.current;
  const ytext = ytextRef.current;
  const awareness = awarenessRef.current;

  // Join on connect
  useEffect(() => {
    const onConnect = () => {
      setSynced(false);
      socket.emit("join-room", { roomId, name });
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => socket.off("connect", onConnect);
  }, [socket, roomId, name]);

  // Full sync
  useEffect(() => {
    const onSync = ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
      setSynced(true);
    };
    socket.on("y-sync", onSync);
    return () => socket.off("y-sync", onSync);
  }, [socket, ydoc]);

  // Remote incremental
  useEffect(() => {
    const onRemoteUpdate = ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
    };
    socket.on("y-update", onRemoteUpdate);
    return () => socket.off("y-update", onRemoteUpdate);
  }, [socket, ydoc]);

  // Local incremental (after synced)
  useEffect(() => {
    const onUpdate = (update, origin) => {
      if (!synced) return;
      if (origin === "remote") return;
      socket.emit("y-update", { roomId, update: Array.from(update) });
    };

    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [socket, roomId, ydoc, synced]);

  return { ydoc, ytext, awareness, synced };
}
