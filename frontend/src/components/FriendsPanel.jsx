import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { friendsAPI } from "../api/friends";
import { socket } from "../config/socket";

// ─── tiny helpers ────────────────────────────────────────────────────────────

function Avatar({ name, size = 8 }) {
    const initials = (name || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    const colors = [
        "from-indigo-500 to-violet-600",
        "from-cyan-500 to-blue-600",
        "from-emerald-500 to-teal-600",
        "from-rose-500 to-pink-600",
        "from-amber-500 to-orange-600",
    ];
    const idx = (name || "").charCodeAt(0) % colors.length;
    return (
        <div
            className={`h-${size} w-${size} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center flex-shrink-0`}
        >
            <span className="text-white font-bold text-xs">{initials}</span>
        </div>
    );
}

function OnlineDot({ online }) {
    return (
        <span
            className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-zinc-900 flex-shrink-0 ${online ? "bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]" : "bg-zinc-600"
                }`}
        />
    );
}

// ─── Tab components ───────────────────────────────────────────────────────────

function FriendsTab({ friends, onlineIds, friendsRooms, onUnfriend, onJoin, onRequestJoin }) {
    if (friends.length === 0) {
        return (
            <div className="flex flex-col items-center py-12 text-zinc-500">
                <span className="text-4xl mb-3">👥</span>
                <p className="text-sm">No friends yet</p>
                <p className="text-xs mt-1 text-zinc-600">Use the Find tab to add some</p>
            </div>
        );
    }

    return (
        <ul className="space-y-2">
            {friends.map((f) => {
                const online = onlineIds.includes(f.id);
                const roomInfo = friendsRooms[f.id];
                
                return (
                    <li
                        key={f.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 hover:border-zinc-600/50 transition-all group"
                    >
                        <div className="relative">
                            <Avatar name={f.name} size={9} />
                            <span className="absolute -bottom-0.5 -right-0.5">
                                <OnlineDot online={online} />
                            </span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-200 truncate">{f.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{f.email}</p>
                            {roomInfo && online && (
                                <p className="text-xs text-indigo-400 truncate mt-0.5">
                                    📍 In: {roomInfo.roomName}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {online && roomInfo ? (
                                roomInfo.isPublic ? (
                                    <button
                                        onClick={() => onJoin(roomInfo.roomId)}
                                        className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
                                    >
                                        Join Room
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onRequestJoin(f, roomInfo)}
                                        className="px-2 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs hover:bg-indigo-500/25 transition-colors whitespace-nowrap"
                                    >
                                        Request
                                    </button>
                                )
                            ) : null}
                            <button
                                onClick={() => onUnfriend(f)}
                                className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function RequestsTab({ incoming, outgoing, onAccept, onDecline }) {
    const total = incoming.length + outgoing.length;

    if (total === 0) {
        return (
            <div className="flex flex-col items-center py-12 text-zinc-500">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-sm">No pending requests</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {incoming.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                        Incoming ({incoming.length})
                    </p>
                    <ul className="space-y-2">
                        {incoming.map((r) => (
                            <li
                                key={r.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-indigo-500/20"
                            >
                                <Avatar name={r.name} size={8} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-200 truncate">{r.name}</p>
                                    <p className="text-xs text-zinc-500 truncate">{r.email}</p>
                                </div>
                                <button
                                    onClick={() => onAccept(r)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/25 transition-colors"
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={() => onDecline(r)}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-colors"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {outgoing.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                        Sent ({outgoing.length})
                    </p>
                    <ul className="space-y-2">
                        {outgoing.map((r) => (
                            <li
                                key={r.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30"
                            >
                                <Avatar name={r.name} size={8} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-100 truncate">{r.name}</p>
                                    <p className="text-xs text-zinc-500 truncate">{r.email}</p>
                                </div>
                                <span className="text-xs text-zinc-500 italic whitespace-nowrap">Pending…</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function FindTab({ currentUserId, onRequestSent }) {
    const [email, setEmail] = useState("");
    const [result, setResult] = useState(null); // { user } | { error }
    const [searching, setSearching] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const debounceRef = useRef(null);

    useEffect(() => {
        setSent(false);
        setResult(null);
        if (!email.trim()) return;

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const data = await friendsAPI.searchByEmail(email.trim());
                setResult({ user: data.user });
            } catch (e) {
                setResult({ error: e.message });
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(debounceRef.current);
    }, [email]);

    const handleAdd = async () => {
        if (!result?.user) return;
        setSending(true);
        try {
            await friendsAPI.sendRequest(result.user.email);
            setSent(true);
            onRequestSent?.();
        } catch (e) {
            setResult({ error: e.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Search by email address…"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-100 placeholder-zinc-500 text-sm focus:border-indigo-500/60 focus:outline-none transition-colors"
                />
                {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
                    </div>
                )}
            </div>

            {result?.error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
                    {result.error}
                </div>
            )}

            {result?.user && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
                    <Avatar name={result.user.name} size={9} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 truncate">{result.user.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{result.user.email}</p>
                    </div>
                    {sent ? (
                        <span className="text-xs text-emerald-400 font-medium whitespace-nowrap">Sent ✓</span>
                    ) : (
                        <button
                            onClick={handleAdd}
                            disabled={sending}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                            {sending ? "Sending…" : "Add Friend"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function FriendsPanel({ isOpen, onClose, currentUser }) {
    const navigate = useNavigate();
    const [tab, setTab] = useState("friends");
    const [friends, setFriends] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [onlineIds, setOnlineIds] = useState([]);
    // Map of userId -> { roomId, roomName, isPublic, ownerId }
    const [friendsRooms, setFriendsRooms] = useState({});
    const [toast, setToast] = useState(null);

    const showToast = useCallback((msg, type = "info") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadAll = useCallback(async () => {
        try {
            const [fl, inc, out] = await Promise.all([
                friendsAPI.listFriends(),
                friendsAPI.getIncoming(),
                friendsAPI.getOutgoing(),
            ]);
            setFriends(fl.friends);
            setIncoming(inc.requests);
            setOutgoing(out.requests);

            // Ask socket layer for current online status
            socket.emit("friends:get-online");
        } catch (e) {
            console.warn("FriendsPanel loadAll error:", e.message);
        }
    }, []);

    // Load on open
    useEffect(() => {
        if (!isOpen) return;
        loadAll();
    }, [isOpen, loadAll]);

    // Socket listeners
    useEffect(() => {
const onOnline = ({ userId }) =>
            setOnlineIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));

        const onOffline = ({ userId }) => {
            setOnlineIds((prev) => prev.filter((id) => id !== userId));
            // Also remove their room info
            setFriendsRooms((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        };

        const onList = ({ onlineIds: ids }) => setOnlineIds(ids);

        // Handle room updates from friends
        const onRoomUpdate = ({ userId, room }) => {
            setFriendsRooms((prev) => {
                if (room) {
                    return { ...prev, [userId]: room };
                } else {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                }
            });
        };

        socket.on("friend:online", onOnline);
        socket.on("friend:offline", onOffline);
        socket.on("friends:online-list", onList);
        socket.on("friend:room-update", onRoomUpdate);

        return () => {
            socket.off("friend:online", onOnline);
            socket.off("friend:offline", onOffline);
            socket.off("friends:online-list", onList);
            socket.off("friend:room-update", onRoomUpdate);
        };
    }, []);

    const handleAccept = async (req) => {
        try {
            await friendsAPI.acceptRequest(req.id);
            showToast(`You and ${req.name} are now friends! 🎉`, "success");
            loadAll();
        } catch (e) {
            showToast(e.message, "error");
        }
    };

    const handleDecline = async (req) => {
        try {
            await friendsAPI.declineRequest(req.id);
            loadAll();
        } catch (e) {
            showToast(e.message, "error");
        }
    };

    const handleUnfriend = async (f) => {
        try {
            await friendsAPI.removeFriend(f.id);
            showToast(`Removed ${f.name}`, "info");
            loadAll();
        } catch (e) {
            showToast(e.message, "error");
        }
    };

const handleJoin = (roomId) => {
        navigate(`/room/${roomId}`);
        onClose();
    };

    const handleRequestJoin = async (friend, roomInfo) => {
        try {
            // Store in DB
            await friendsAPI.requestJoinRoom(roomInfo.roomId);
            // Also notify via socket so owner sees it live
            socket.emit("friend:join-room-request", {
                roomId: roomInfo.roomId,
                ownerId: roomInfo.ownerId,
                requesterName: currentUser?.name,
            });
            showToast(`Request sent to ${friend.name}`, "success");
        } catch (e) {
            showToast(e.message, "error");
        }
    };

    const pendingCount = incoming.length;

    const tabs = [
        { id: "friends", label: "Friends", badge: null },
        { id: "requests", label: "Requests", badge: pendingCount || null },
        { id: "find", label: "Find", badge: null },
    ];

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
                    onClick={onClose}
                />
            )}

            {/* Slide-in panel */}
            <div
                className={`fixed top-0 right-0 h-full z-50 flex flex-col w-80 sm:w-96
          bg-zinc-950/95 border-l border-zinc-800/60 backdrop-blur-xl shadow-2xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
                    <div>
                        <h2 className="text-base font-bold text-zinc-100">Friends</h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {friends.length} friend{friends.length !== 1 ? "s" : ""} ·{" "}
                            <span className="text-emerald-400">{onlineIds.length} online</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800/50 px-2 pt-2">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`relative flex-1 py-2 text-xs font-semibold rounded-t-lg transition-colors ${tab === t.id
                                ? "text-indigo-300 bg-indigo-500/10 border border-b-0 border-indigo-500/20"
                                : "text-zinc-500 hover:text-zinc-300"
                                }`}
                        >
                            {t.label}
                            {t.badge ? (
                                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">
                                    {t.badge}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>

{/* Content */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    {tab === "friends" && (
                        <FriendsTab
                            friends={friends}
                            onlineIds={onlineIds}
                            friendsRooms={friendsRooms}
                            onUnfriend={handleUnfriend}
                            onJoin={handleJoin}
                            onRequestJoin={handleRequestJoin}
                        />
                    )}
                    {tab === "requests" && (
                        <RequestsTab
                            incoming={incoming}
                            outgoing={outgoing}
                            onAccept={handleAccept}
                            onDecline={handleDecline}
                        />
                    )}
                    {tab === "find" && (
                        <FindTab
                            currentUserId={currentUser?.id}
                            onRequestSent={() => {
                                loadAll();
                                setTab("requests");
                            }}
                        />
                    )}
                </div>

                {/* Toast */}
                {toast && (
                    <div
                        className={`mx-4 mb-4 px-4 py-3 rounded-xl text-sm font-medium border shadow-lg transition-all ${toast.type === "success"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                            : toast.type === "error"
                                ? "bg-red-500/15 border-red-500/30 text-red-200"
                                : "bg-zinc-800/80 border-zinc-700/50 text-zinc-200"
                            }`}
                    >
                        {toast.msg}
                    </div>
                )}
            </div>
        </>
    );
}
