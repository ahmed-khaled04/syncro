import { useEffect, useMemo, useState } from "react";

export default function OnlineUsers({
  awareness,
  ownerId,
  allowedEditors = [],
  locked = false,
}) {
  const [users, setUsers] = useState([]);

  const myUserId = useMemo(() => {
    try {
      return localStorage.getItem("syncro-user-id");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!awareness) return;

    const updateUsers = () => {
      const entries = Array.from(awareness.getStates().entries());
      const groups = new Map();

      for (const [clientId, s] of entries) {
        const u = s?.user || {};
        const userId = u.id || `client:${clientId}`;

        if (!groups.has(userId)) {
          groups.set(userId, {
            userId,
            name: u.name || "Anonymous",
            color: u.color || "#888",
            editing: false, // ✅ we use "editing" (set by CollabEditor)
          });
        }

        const g = groups.get(userId);

        // ✅ If any client instance is editing, show editing
        if (s?.editing === true) g.editing = true;

        // Keep best-known name/color
        if ((!g.name || g.name === "Anonymous") && u.name) g.name = u.name;
        if ((!g.color || g.color === "#888") && u.color) g.color = u.color;
      }

      let list = Array.from(groups.values()).map((g) => {
        const isOwner = !!ownerId && g.userId === ownerId;
        const isEditor = !!locked && allowedEditors.includes(g.userId);
        const isViewer = !!locked && !isOwner && !isEditor;

        return {
          id: g.userId,
          name: g.name,
          color: g.color,
          editing: g.editing,
          isOwner,
          isEditor,
          isViewer,
        };
      });

      // Sort: Me -> Owner -> Editors -> Viewers
      list.sort((a, b) => {
        const aMe = myUserId && a.id === myUserId ? 0 : 1;
        const bMe = myUserId && b.id === myUserId ? 0 : 1;
        if (aMe !== bMe) return aMe - bMe;

        const aOwner = a.isOwner ? 0 : 1;
        const bOwner = b.isOwner ? 0 : 1;
        if (aOwner !== bOwner) return aOwner - bOwner;

        const aEditor = a.isEditor ? 0 : 1;
        const bEditor = b.isEditor ? 0 : 1;
        if (aEditor !== bEditor) return aEditor - bEditor;

        return String(a.name).localeCompare(String(b.name));
      });

      setUsers(list);
    };

    updateUsers();
    awareness.on("update", updateUsers);
    awareness.on("change", updateUsers);

    return () => {
      awareness.off("update", updateUsers);
      awareness.off("change", updateUsers);
    };
  }, [awareness, ownerId, allowedEditors, locked, myUserId]);

  if (!awareness) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-400">
          Online{" "}
          <span className="text-zinc-200 font-semibold">({users.length})</span>
        </span>

        {users.map((user) => {
          const isMe = myUserId && user.id === myUserId;

          const roleBadge = user.isOwner
            ? { label: "Owner", cls: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/20" }
            : user.isEditor
            ? { label: "Editor", cls: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20" }
            : user.isViewer
            ? { label: "Viewer", cls: "bg-zinc-800/60 text-zinc-200 ring-1 ring-zinc-700" }
            : null; // unlocked room => no role labels needed

          return (
            <div
              key={user.id}
              className={[
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs border transition",
                isMe
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-100"
                  : "border-zinc-800 bg-zinc-800/40 text-zinc-100",
              ].join(" ")}
              title={isMe ? "You" : user.name}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: user.color }} />

              <span className="max-w-[120px] truncate">
                {user.isOwner ? "👑 " : ""}
                {user.name || "Anonymous"}
              </span>

              {/* typing / editing indicator */}
              {user.editing && (
                <span className="ml-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-200 ring-1 ring-indigo-500/20">
                  ✍️ typing
                </span>
              )}

              {roleBadge && (
                <span className={["ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", roleBadge.cls].join(" ")}>
                  {roleBadge.label}
                </span>
              )}

              {isMe && (
                <span className="ml-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
