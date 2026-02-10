import { useEffect, useMemo, useState } from "react";

export default function OnlineUsers({ awareness }) {
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
      // states: Map<clientId, state>
      const entries = Array.from(awareness.getStates().entries());

      // ✅ group by stable user.id to kill refresh duplicates
      const groups = new Map();

      for (const [clientId, s] of entries) {
        const u = s.user || {};
        const userId = u.id || `client:${clientId}`; // fallback just in case

        if (!groups.has(userId)) {
          groups.set(userId, {
            userId,
            name: u.name || "Anonymous",
            color: u.color || "#888",
            typing: false,
            clientIds: new Set(),
          });
        }

        const g = groups.get(userId);
        g.clientIds.add(clientId);
        if (s.typing) g.typing = true;

        // keep best name/color if they appear later
        if (!g.name && u.name) g.name = u.name;
        if ((!g.color || g.color === "#888") && u.color) g.color = u.color;
      }

      let list = Array.from(groups.values()).map((g) => ({
        id: g.userId,
        name: g.name,
        color: g.color,
        typing: g.typing,
      }));

      // ✅ me first
      if (myUserId) {
        list = list.sort((a, b) => {
          const aMe = a.id === myUserId ? 0 : 1;
          const bMe = b.id === myUserId ? 0 : 1;
          return aMe - bMe;
        });
      }

      setUsers(list);
    };

    updateUsers();
    awareness.on("update", updateUsers);
    awareness.on("change", updateUsers);

    return () => {
      awareness.off("update", updateUsers);
      awareness.off("change", updateUsers);
    };
  }, [awareness, myUserId]);

  if (!awareness) return null;

  const typingUsers = users
    .filter((u) => u.typing && (!myUserId || u.id !== myUserId))
    .map((u) => u.name);

  const typingText =
    typingUsers.length === 0
      ? ""
      : typingUsers.length === 1
      ? `${typingUsers[0]} is typing…`
      : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
      : `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2} more are typing…`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-400">
          Online{" "}
          <span className="text-zinc-200 font-semibold">({users.length})</span>
        </span>

        {users.map((user) => {
          const isMe = myUserId && user.id === myUserId;

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
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: user.color }}
              />
              <span className="max-w-[120px] truncate">
                {user.name || "Anonymous"}
              </span>

              {user.typing && !isMe && (
                <span className="ml-1 rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                  typing
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

      {typingText && (
        <div className="text-[11px] text-zinc-400">{typingText}</div>
      )}
    </div>
  );
}
