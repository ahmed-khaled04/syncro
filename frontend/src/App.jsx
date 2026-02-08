import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  transports: ["websocket"],
});

export default function App() {
  const [log, setLog] = useState([]);
  const [text, setText] = useState("");
  const roomId = "123";
  const name = "Khaled";

  useEffect(() => {
    const onConnect = () => {
      setLog((l) => [`✅ connected: ${socket.id}`, ...l]);
      socket.emit("join-room", { roomId, name });
    };

    const onDocUpdate = (newText) => {
      console.log("✅ received doc-update len:", newText.length);
      setText(newText);
    };

    socket.on("connect", onConnect);
    socket.on("system", (msg) => setLog((l) => [`[system] ${msg}`, ...l]));
    socket.on("pong-room", (p) => setLog((l) => [`${p.from}: ${p.text}`, ...l]));
    socket.on("doc-update", onDocUpdate);

    // Important: if already connected, run onConnect immediately
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("doc-update", onDocUpdate);
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => socket.emit("ping-room", { roomId, text: "hello!" })}>
        Send test ping
      </button>

      <textarea
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          socket.emit("doc-update", { roomId, text: value });
        }}
        style={{ width: 420, height: 200, display: "block", marginTop: 12 }}
      />

      <pre style={{ marginTop: 16, background: "#111", color: "#0f0", padding: 12 }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}
