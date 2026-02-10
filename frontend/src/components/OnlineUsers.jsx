import { useEffect, useState } from "react";

export default function OnlineUsers({ awareness }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    function updateUsers() {
      const states = Array.from(awareness.getStates().values());
      const mapped = states
        .map((s) => s.user)
        .filter(Boolean);
      setUsers(mapped);
    }

    updateUsers();
    awareness.on("change", updateUsers);

    return () => awareness.off("change", updateUsers);
  }, [awareness]);

  return (
    <div className="flex items-center gap-2">
      {users.map((user, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-800/40 px-3 py-1 text-xs"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: user.color }}
          />
          <span className="max-w-[100px] truncate">{user.name}</span>
        </div>
      ))}
    </div>
  );
}
