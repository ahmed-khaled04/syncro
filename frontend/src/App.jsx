import { socket } from "./config/socket";
import { useRoomLanguage } from "./hooks/useRoomLanguage";
import { useYjsSync } from "./hooks/useYjsSync";
import EditorHeader from "./components/EditorHeader";
import CollabEditor from "./components/CollabEditor";

export default function App() {
  const roomId = "123";
  const name = "Khaled";

  const { ytext, awareness, synced } = useYjsSync(socket, roomId, name);
  const { lang, setRoomLanguage } = useRoomLanguage(socket, roomId, "js");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* soft gradient glows */}
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -left-48 -top-48 h-[420px] w-[420px] rounded-full bg-indigo-600 blur-[140px]" />
        <div className="absolute -right-56 -bottom-56 h-[520px] w-[520px] rounded-full bg-fuchsia-600 blur-[160px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Syncro</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time collaborative editor (Socket.IO + Yjs)
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur">
          <EditorHeader
            roomId={roomId}
            synced={synced}
            lang={lang}
            onChangeLang={setRoomLanguage}
          />

          <div className="border-t border-zinc-800 p-4">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
              <CollabEditor lang={lang} ytext={ytext} awareness={awareness} />
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          Open two tabs → join same room → type to see live sync.
        </div>
      </div>
    </div>
  );
}
