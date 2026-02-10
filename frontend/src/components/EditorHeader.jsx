import { LANGS } from "../constants/langs";

import OnlineUsers from "./OnlineUsers";


function StatusPill({ synced }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        synced
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
          : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", synced ? "bg-emerald-400" : "bg-amber-400"].join(" ")} />
      {synced ? "Synced" : "Syncing"}
    </span>
  );
}

export default function EditorHeader({ roomId, synced, lang, onChangeLang , awareness }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-zinc-700">
          <span className="text-lg">⚡</span>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold tracking-tight">Room</div>
            <StatusPill synced={synced} />
          </div>

          <div className="mt-0.5 font-mono text-xs text-zinc-400">{roomId}</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <OnlineUsers awareness={awareness}/>
        <label className="text-xs font-medium text-zinc-400">Language</label>

        <div className="relative">
          <select
            value={lang}
            onChange={(e) => onChangeLang(e.target.value)}
            className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 pr-9 text-sm text-zinc-100 outline-none transition
                       focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 sm:w-56"
          >
            {Object.entries(LANGS).map(([id, info]) => (
              <option key={id} value={id}>
                {info.label}
              </option>
            ))}
          </select>

          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-400">
            ▾
          </div>
        </div>
      </div>
    </div>
  );
}
