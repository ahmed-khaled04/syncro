import { useLocation, useParams, Navigate, useNavigate } from "react-router-dom";
import { socket } from "../config/socket";
import { useRoomLanguage } from "../hooks/useRoomLanguage";
import { useYjsSync } from "../hooks/useYjsSync";
import EditorHeader from "../components/EditorHeader";
import CollabEditor from "../components/CollabEditor";

export default function RoomPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const name = location.state?.name;

  // If user opened link directly without name
  if (!name) {
    return <Navigate to="/" replace />;
  }

  const { ytext, awareness, synced, ready } = useYjsSync(socket, roomId, name);
  const { lang, setRoomLanguage } = useRoomLanguage(socket, roomId, "js");

  // ---------- LOADING STATE ----------
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        
        {/* -------- TOP BAR -------- */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
            >
              ← Leave room
            </button>

            <div className="text-sm text-zinc-400">
              Room: <span className="text-zinc-200 font-medium">{roomId}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                synced
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-yellow-500/40 text-yellow-400"
              }`}
            >
              {synced ? "Synced" : "Syncing…"}
            </span>
          </div>
        </div>

        {/* -------- HEADER -------- */}
        <EditorHeader
          roomId={roomId}
          synced={synced}
          lang={lang}
          onChangeLang={setRoomLanguage}
          awareness={awareness}
        />

        {/* -------- EDITOR -------- */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xl overflow-hidden">
          <CollabEditor lang={lang} ytext={ytext} awareness={awareness} />
        </div>
      </div>
    </div>
  );
}
