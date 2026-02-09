import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { yCollab } from "y-codemirror.next";

import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";

const socket = io("http://localhost:4000", { transports: ["websocket"] });

const LANGS = {
  js: { label: "JavaScript", ext: () => javascript() },
  py: { label: "Python", ext: () => python() },
  cpp: { label: "C++", ext: () => cpp() },
  html: { label: "HTML", ext: () => html() },
};

export default function App() {
  const roomId = "123";
  const name = "Khaled";

  const [lang, setLang] = useState("js");
  const [synced, setSynced] = useState(false);

  // Yjs doc (one per tab)
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

  // 1) Join room when connected
  useEffect(() => {
    const onConnect = () => {
      console.log("✅ connected", socket.id);
      setSynced(false); // must re-sync on every reconnect
      socket.emit("join-room", { roomId, name });
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => socket.off("connect", onConnect);
  }, [roomId, name]);

  // 2) Receive FULL sync from server (on join/refresh)
  useEffect(() => {
    const onSync = ({ update }) => {
      const u8 = new Uint8Array(update);
      Y.applyUpdate(ydoc, u8, "remote");
      console.log("✅ full sync applied bytes:", u8.length);
      setSynced(true);
    };

    socket.on("y-sync", onSync);
    return () => socket.off("y-sync", onSync);
  }, [ydoc]);

  // 3) Receive remote incremental updates
  useEffect(() => {
    const onRemoteUpdate = ({ update }) => {
      const u8 = new Uint8Array(update);
      // Apply as remote so we don't rebroadcast it
      Y.applyUpdate(ydoc, u8, "remote");
    };

    socket.on("y-update", onRemoteUpdate);
    return () => socket.off("y-update", onRemoteUpdate);
  }, [ydoc]);

  // 4) Send local incremental updates (ONLY after synced)
  useEffect(() => {
    const onUpdate = (update, origin) => {
      if (!synced) return;
      if (origin === "remote") return;

      socket.emit("y-update", { roomId, update: Array.from(update) });
    };

    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [roomId, ydoc, synced]);

  // 5) Room language (shared metadata)
  useEffect(() => {
    const onRoomLanguage = ({ roomId: rid, lang: newLang }) => {
      if (rid === roomId) setLang(newLang);
    };

    socket.on("room-language", onRoomLanguage);
    return () => socket.off("room-language", onRoomLanguage);
  }, [roomId]);

  // Editor extensions
  const extensions = useMemo(() => {
    const langExt = LANGS[lang]?.ext ? LANGS[lang].ext() : javascript();
    return [langExt, yCollab(ytext, awareness, { undoManager: new Y.UndoManager(ytext) })];
  }, [lang, ytext, awareness]);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div>
          <b>Room:</b> {roomId}{" "}
          <span style={{ marginLeft: 10 }}>
            <b>Status:</b> {synced ? "Synced ✅" : "Syncing..."}
          </span>
        </div>

        <label style={{ marginLeft: "auto" }}>
          <b>Room language:</b>{" "}
          <select
            value={lang}
            onChange={(e) => socket.emit("set-room-language", { roomId, lang: e.target.value })}
          >
            {Object.entries(LANGS).map(([id, info]) => (
              <option key={id} value={id}>
                {info.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CodeMirror height="420px" theme={oneDark} extensions={extensions} />
    </div>
  );
}
