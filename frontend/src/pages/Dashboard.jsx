import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { roomsAPI } from "../api/rooms";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modals
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [joinRoomModalOpen, setJoinRoomModalOpen] = useState(false);
  const [deleteRoomModalOpen, setDeleteRoomModalOpen] = useState(false);
  const [settingsRoomModalOpen, setSettingsRoomModalOpen] = useState(false);
  const [createRoomName, setCreateRoomName] = useState("");
  const [createRoomDescription, setCreateRoomDescription] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [roomToManage, setRoomToManage] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [newRoomLanguage, setNewRoomLanguage] = useState("js");
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(true);
  const [roomAvailability, setRoomAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [entering, setEntering] = useState(false);
  const [enteringRoomId, setEnteringRoomId] = useState(null);

  // Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const userRooms = await roomsAPI.getMyRooms();
        console.log("Loaded rooms:", userRooms);
        setRooms(userRooms);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
  }, []);

  // Check room availability when join room ID changes
  useEffect(() => {
    if (!joinRoomId.trim() || !joinRoomModalOpen) {
      setRoomAvailability(null);
      return;
    }

    const checkAvailability = async () => {
      setCheckingAvailability(true);
      try {
        const availability = await roomsAPI.checkRoomAvailability(joinRoomId);
        setRoomAvailability(availability);
      } catch (err) {
        console.error("Failed to check room availability:", err);
        setRoomAvailability(null);
      } finally {
        setCheckingAvailability(false);
      }
    };

    // Debounce availability check
    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [joinRoomId, joinRoomModalOpen]);

  // Auto-dismiss error message
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const reloadRooms = async () => {
    try {
      const userRooms = await roomsAPI.getMyRooms();
      setRooms(userRooms);
    } catch (err) {
      console.error("Failed to reload rooms:", err);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setCreating(true);

    try {
      if (!createRoomName.trim()) {
        throw new Error("Room name is required");
      }

      const newRoom = await roomsAPI.createRoom(createRoomName, createRoomDescription);
      await reloadRooms();
      setCreateRoomName("");
      setCreateRoomDescription("");
      setCreateRoomModalOpen(false);
      setSuccessMessage(`Room "${createRoomName}" created! Redirecting...`);

      setTimeout(() => {
        navigate(`/room/${newRoom.room_id}`);
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setJoining(true);

    try {
      if (!joinRoomId.trim()) {
        throw new Error("Room ID is required");
      }

      await roomsAPI.joinRoom(joinRoomId);
      await reloadRooms();
      setJoinRoomId("");
      setJoinRoomModalOpen(false);
      setSuccessMessage(`Joined room "${joinRoomId}"! Redirecting...`);

      setTimeout(() => {
        navigate(`/room/${joinRoomId}`);
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteRoom = (roomId) => {
    setRoomToDelete(roomId);
    setDeleteRoomModalOpen(true);
    setError("");
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;

    setError("");
    setSuccessMessage("");
    setDeleting(true);

    try {
      await roomsAPI.deleteRoom(roomToDelete);
      await reloadRooms();
      setSuccessMessage("Room deleted successfully");
      setDeleteRoomModalOpen(false);
      setRoomToDelete(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleEnterRoom = async (roomId, isOwner = false) => {
    // If user is the owner, they can always enter
    if (isOwner) {
      setEnteringRoomId(roomId);
      setEntering(true);
      navigate(`/room/${roomId}`, {
        state: { isOwner },
      });
      return;
    }

    // For non-owners, check if owner is online
    setEnteringRoomId(roomId);
    setEntering(true);
    try {
      setError("");
      const availability = await roomsAPI.checkRoomAvailability(roomId);
      
      if (!availability.ownerOnline) {
        setError("❌ Room owner is not online. You can only enter when the owner is inside the room.");
        setEntering(false);
        setEnteringRoomId(null);
        return;
      }

      navigate(`/room/${roomId}`, {
        state: { isOwner },
      });
    } catch (err) {
      setError(`❌ ${err.message}`);
      setEntering(false);
      setEnteringRoomId(null);
    }
  };

  const ownedRooms = rooms.filter((r) => r.is_owner);
  const visitedRooms = rooms.filter((r) => !r.is_owner);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 overflow-hidden">
      <style>{`
        @keyframes slideInDown {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-in { animation: slideInDown 0.3s ease-out; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>

      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-[520px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              Syncro
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Collaborative Editor</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-300">{user?.name}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Fixed Notifications - positioned at original location */}
      <div
        className="fixed left-0 right-0 z-50 pointer-events-none pb-32"
        style={{ top: "110px" }}
      >
        <div className="mx-auto max-w-7xl px-6 pt-0">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/30 border border-red-500/50 text-red-300 backdrop-blur-sm animate-slide-in shadow-xl pointer-events-auto">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-4 rounded-lg bg-green-500/30 border border-green-500/50 text-green-300 backdrop-blur-sm animate-slide-in shadow-xl pointer-events-auto">
              {successMessage}
            </div>
          )}
        </div>
      </div>
      {/* Main Content */}
      <main className="relative mx-auto max-w-7xl px-6 py-12">
        {/* Messages - Removed (moved to fixed position at top) */}

        {/* Action Buttons */}
        <div className="mt-8 mb-12 flex gap-4">
          <button
            onClick={() => {
              setCreateRoomModalOpen(true);
              setError("");
            }}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20"
          >
            + Create Room
          </button>
          <button
            onClick={() => {
              setJoinRoomModalOpen(true);
              setError("");
            }}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-semibold transition-all hover:shadow-lg hover:shadow-cyan-500/20"
          >
            🔗 Join Room
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
              <p className="text-zinc-400">Loading your rooms...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-fade-in">
            {/* Owned Rooms */}
            {ownedRooms.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <span className="inline-block w-1 h-8 bg-gradient-to-b from-indigo-500 to-cyan-500 rounded" />
                  Your Rooms
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ownedRooms.map((room) => (
                    <div
                      key={room.room_id}
                      className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm hover:border-indigo-500/50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="relative p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-zinc-100">
                                {!room.is_public && <span className="text-red-400 mr-1" title="Private room">🔒</span>}
                                {room.name || "Untitled Room"}
                              </h3>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Owner
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-2">ID: <span className="font-mono">{room.room_id}</span></p>
                            <p className="text-xs text-zinc-400">Language: {room.lang || "js"}</p>
                          </div>
                        </div>

                        {room.description && (
                          <p className="text-sm text-zinc-300 mb-4 italic">{room.description}</p>
                        )}

                        <p className="text-xs text-zinc-500 mb-4">
                          Created {new Date(room.joined_at).toLocaleDateString()}
                        </p>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEnterRoom(room.room_id, room.is_owner)}
                            disabled={entering && enteringRoomId === room.room_id}
                            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {entering && enteringRoomId === room.room_id ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Entering...
                              </>
                            ) : (
                              "Enter"
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setRoomToManage(room);
                              setNewRoomName(room.name || "");
                              setNewRoomDescription(room.description || "");
                              setNewRoomLanguage(room.lang || "js");
                              setNewRoomIsPublic(room.is_public !== false);
                              setSettingsRoomModalOpen(true);
                            }}
                            className="px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm"
                            title="Room Settings"
                          >
                            ⚙
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(room.room_id)}
                            className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Visited Rooms */}
            {visitedRooms.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <span className="inline-block w-1 h-8 bg-gradient-to-b from-cyan-500 to-violet-500 rounded" />
                  Recent Visits
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visitedRooms.map((room) => (
                    <div
                      key={room.room_id}
                      className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm hover:border-cyan-500/50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="relative p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-zinc-100">
                                {!room.is_public && <span className="text-red-400 mr-1" title="Private room">🔒</span>}
                                {room.name || "Untitled Room"}
                              </h3>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                Guest
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-2">ID: <span className="font-mono">{room.room_id}</span></p>
                            <p className="text-xs text-zinc-400">Language: {room.lang || "js"}</p>
                          </div>
                        </div>

                        {room.description && (
                          <p className="text-sm text-zinc-300 mb-4 italic">{room.description}</p>
                        )}

                        <p className="text-xs text-zinc-500 mb-4">
                          Last visited {new Date(room.last_visited_at).toLocaleDateString()}
                        </p>

                        <button
                          onClick={() => handleEnterRoom(room.room_id, room.is_owner)}
                          disabled={entering && enteringRoomId === room.room_id}
                          className="w-full px-4 py-2 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {entering && enteringRoomId === room.room_id ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Entering...
                            </>
                          ) : (
                            "Enter Room"
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {rooms.length === 0 && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🚀</div>
                <h3 className="text-2xl font-bold text-zinc-300 mb-2">No Rooms Yet</h3>
                <p className="text-zinc-400 mb-8">Create your first room or join an existing one to get started</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => {
                      setCreateRoomModalOpen(true);
                      setError("");
                    }}
                    className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                  >
                    Create Room
                  </button>
                  <button
                    onClick={() => {
                      setJoinRoomModalOpen(true);
                      setError("");
                    }}
                    className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      {createRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-8 animate-slide-in">
            <h3 className="text-2xl font-bold text-zinc-100 mb-6">Create New Room</h3>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Room Name</label>
                <input
                  type="text"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  placeholder="e.g., Frontend Project"
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition-colors"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description <span className="text-xs text-zinc-500">(optional)</span></label>
                <textarea
                  value={createRoomDescription}
                  onChange={(e) => setCreateRoomDescription(e.target.value)}
                  placeholder="e.g., Backend refactor for auth module"
                  rows="2"
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                  disabled={creating}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateRoomModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    "Create Room"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {joinRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-8 animate-slide-in">
            <h3 className="text-2xl font-bold text-zinc-100 mb-6">Join Room</h3>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Room ID</label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toLowerCase())}
                  placeholder="e.g., abc123"
                  maxLength="6"
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none transition-colors"
                  disabled={joining}
                />
                <p className="text-xs text-zinc-500 mt-2">Ask someone in the room to share the room ID</p>
              </div>

              {/* Room Availability Check */}
              {checkingAvailability && joinRoomId.trim() && (
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-cyan-500" />
                    Checking room...
                  </div>
                </div>
              )}

              {roomAvailability && !checkingAvailability && (
                <div className={`p-3 rounded-lg border ${
                  roomAvailability.ownerOnline
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {roomAvailability.ownerOnline ? (
                      <>
                        <span className="h-2 w-2 bg-green-500 rounded-full" />
                        Owner is online ✓
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 bg-red-500 rounded-full" />
                        Owner is offline - cannot join
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setJoinRoomModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
                  disabled={joining}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || (roomAvailability && !roomAvailability.ownerOnline)}
                  className="flex-1 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {joining ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Joining...
                    </>
                  ) : (
                    "Join Room"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Room Modal */}
      {deleteRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-8 animate-slide-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/30">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-zinc-100">Delete Room</h3>
                <p className="text-sm text-zinc-400 mt-1">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-zinc-300 mb-6">
              Are you sure you want to delete room <span className="font-mono text-red-400">#{roomToDelete}</span>? This will permanently remove all data associated with this room.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteRoomModalOpen(false);
                  setRoomToDelete(null);
                  setError("");
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoom}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  "Delete Room"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Room Modal */}
      {settingsRoomModalOpen && roomToManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md maximum-h-[90vh] overflow-y-auto animate-slide-in">
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-6">
              <h3 className="text-xl font-bold text-zinc-100">Room Settings</h3>
              <p className="text-sm text-zinc-400 mt-1">{roomToManage.name || "Untitled Room"}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Language Setting */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  🔤 Programming Language
                </label>
                <select
                  value={newRoomLanguage}
                  onChange={(e) => setNewRoomLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:border-indigo-500 focus:outline-none transition-colors"
                >
                  <option value="js">JavaScript</option>
                  <option value="py">Python</option>
                  <option value="ts">TypeScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="csharp">C#</option>
                  <option value="ruby">Ruby</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>

              {/* Rename Room */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  ✏️ Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name"
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Room Description */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  📝 Description
                </label>
                <textarea
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  placeholder="Enter room description (optional)"
                  rows="3"
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Privacy Setting */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  {newRoomIsPublic ? "🌐 Public Room" : "🔒 Private Room"}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewRoomIsPublic(true)}
                    className={`flex-1 px-4 py-3 rounded-lg border font-medium transition-all ${
                      newRoomIsPublic
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-100"
                        : "bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    🌐 Public
                  </button>
                  <button
                    onClick={() => setNewRoomIsPublic(false)}
                    className={`flex-1 px-4 py-3 rounded-lg border font-medium transition-all ${
                      !newRoomIsPublic
                        ? "bg-red-500/20 border-red-500/50 text-red-100"
                        : "bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    🔒 Private
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {newRoomIsPublic
                    ? "Anyone can join with owner online (or with invite)"
                    : "Only people with an invite can join (owner must be online)"}
                </p>
              </div>

              {/* Delete Room from Settings */}
              <div>
                <button
                  onClick={() => {
                    setSettingsRoomModalOpen(false);
                    handleDeleteRoom(roomToManage.room_id);
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                >
                  🗑️ Delete Room
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSettingsRoomModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={updating}
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  setUpdating(true);
                  try {
                    // Update room settings
                    await roomsAPI.updateRoom(roomToManage.room_id, {
                      name: newRoomName,
                      description: newRoomDescription,
                      lang: newRoomLanguage,
                      is_public: newRoomIsPublic,
                    });

                    setSuccessMessage("Room settings updated successfully!");
                    setSettingsRoomModalOpen(false);
                    await reloadRooms(); // Reload rooms to reflect changes
                  } catch (err) {
                    setError(err.message || "Failed to update room settings");
                    console.error("Error updating room:", err);
                  } finally {
                    setUpdating(false);
                  }
                }}
                disabled={updating || !newRoomName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
