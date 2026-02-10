import { useEffect, useState } from "react";

export default function OnlineUsers({ awareness }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    const updateUsers = () => {
      const states = Array.from(awareness.getStates().values());

      // ✅ dedupe by stable user.id (prevents refresh duplicates)
      const unique = new Map();
      for (const s of states) {
        const u = s.user;
        if (!u?.id) continue;
        unique.set(u.id, u);
      }

      setUsers(Array.from(unique.values()));
    };

    updateUsers();
    awareness.on("change", updateUsers);
    return () => awareness.off("change", updateUsers);
  }, [awareness]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {users.map((user) => (
        <div
          key={user.id} // ✅ stable key
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-800/40 px-3 py-1 text-xs"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: user.color }}
          />
          <span className="max-w-[120px] truncate">{user.name}</span>
        </div>
      ))}
    </div>
  );
}
