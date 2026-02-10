import { useState } from "react";
import { useNavigate } from "react-router-dom";

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function JoinPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;

    navigate(`/room/${roomId}`, {
      state: { name },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <form
        onSubmit={handleJoin}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl backdrop-blur"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Join Syncro</h1>
        <p className="text-sm text-zinc-400">
          Real-time collaborative editor
        </p>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Joe"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Room ID</label>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g. abc123"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRoomId(generateRoomId())}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-800/40 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Generate
          </button>

          <button
            type="submit"
            className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            Join
          </button>
        </div>
      </form>
    </div>
  );
}
