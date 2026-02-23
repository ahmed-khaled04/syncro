import { useState, useEffect } from "react";
import { roomsAPI } from "../api/rooms";

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

export default function JoinRequestsPanel({ roomId, isOpen, onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch join requests
  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await roomsAPI.listJoinRequests(roomId);
      // Handle both { requests: [...] } and [...] formats
      const requestsList = Array.isArray(data) ? data : data.requests || [];
      console.log("📋 Join requests loaded:", requestsList);
      setRequests(requestsList);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch join requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && roomId) {
      fetchRequests();
    }
  }, [isOpen, roomId]);

  const handleAccept = async (requesterId) => {
    setActionLoading(requesterId);
    setError("");
    setSuccess("");
    try {
      await roomsAPI.acceptJoinRequest(roomId, requesterId);
      // Remove from list after accepting
      const accepted = requests.find((r) => r.id === requesterId);
      setRequests(requests.filter((r) => r.id !== requesterId));
      setSuccess(`✅ ${accepted?.name || "User"} has been accepted as an editor!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(`Failed to accept request: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requesterId) => {
    setActionLoading(requesterId);
    try {
      await roomsAPI.declineJoinRequest(roomId, requesterId);
      // Remove from list after declining
      setRequests(requests.filter((r) => r.id !== requesterId));
    } catch (err) {
      setError(`Failed to decline request: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg shadow-xl border border-zinc-700 w-full max-w-2xl max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🔔</span>
            Join Requests
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-zinc-400">
                <div className="animate-spin">⏳</div>
                <p className="text-sm mt-2">Loading requests...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="m-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="m-4 p-3 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-400 text-sm">
              {success}
            </div>
          )}

          {!loading && requests.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <span className="text-4xl mb-2">✨</span>
              <p className="text-sm">No pending requests</p>
              <p className="text-xs mt-1 text-zinc-600">All caught up!</p>
            </div>
          )}

          {!loading && requests.length > 0 && (
            <div className="divide-y divide-zinc-700">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-4"
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={request.name || "User"} size={10} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {request.name || "Unknown User"}
                      </p>
                      {request.email && (
                        <p className="text-xs text-zinc-400 truncate">
                          {request.email}
                        </p>
                      )}
                      {request.created_at && (
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(request.created_at).toLocaleDateString()} at{" "}
                          {new Date(request.created_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(request.id)}
                      disabled={actionLoading !== null}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                    >
                      {actionLoading === request.id ? "..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleDecline(request.id)}
                      disabled={actionLoading !== null}
                      className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                    >
                      {actionLoading === request.id ? "..." : "Decline"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-700 p-4 flex justify-end">
          <button
            onClick={() => {
              fetchRequests();
            }}
            className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
