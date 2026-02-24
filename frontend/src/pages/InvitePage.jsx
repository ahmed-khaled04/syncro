import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { roomsAPI } from "../api/rooms";

export default function InvitePage() {
  const { roomId, token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);

  // Check if we just came back from signing in
  useEffect(() => {
    if (user && !authLoading && !justSignedIn) {
      setJustSignedIn(true);
    }
  }, [user, authLoading, justSignedIn]);

  // Join room logic
  const joinRoom = useCallback(async () => {
    if (!user) return;
    try {
      setJoining(true);
      setError("");
      await roomsAPI.joinRoom(roomId, token);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err.message || "Failed to join room");
      setJoining(false);
    }
  }, [roomId, token, user, navigate]);

  // Auto-join when signed in and room info is loaded
  useEffect(() => {
    if (justSignedIn && roomInfo && user && !joining && !authLoading) {
      joinRoom();
    }
  }, [justSignedIn, roomInfo, user, joining, authLoading, joinRoom]);

  // Validate and load invite details
  useEffect(() => {
    const validateInvite = async () => {
      try {
        setLoading(true);
        const data = await roomsAPI.validateInvite(roomId, token);
        if (!data.valid) {
          setError("This invite is invalid or expired");
          return;
        }
        setRoomInfo(data.invite);
      } catch (err) {
        setError(err.message || "Failed to validate invite");
      } finally {
        setLoading(false);
      }
    };

    if (roomId && token) {
      validateInvite();
    }
  }, [roomId, token]);

  const handleJoin = async () => {
    if (authLoading) {
      // Auth still loading, button should be disabled
      return;
    }
    if (!user) {
      // Redirect to auth page with return URL and mode
      navigate(`/?mode=login&returnTo=/invite/${roomId}/${token}`);
      return;
    }
    await joinRoom();
  };

  if (loading || joining || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
          <p className="text-sm text-zinc-400">{authLoading ? "Checking authentication..." : joining ? "Joining room..." : "Loading invite..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <span className="text-4xl mb-3 block">❌</span>
            <h1 className="text-2xl font-bold mb-2">Invite Invalid</h1>
            <p className="text-zinc-400 mb-6">{error}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        ) : roomInfo ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">📨</span>
              <div>
                <h1 className="text-3xl font-bold">You're Invited!</h1>
                <p className="text-sm text-zinc-400">to join a collaborative room</p>
              </div>
            </div>

            <div className="space-y-4 mb-6 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
              {roomInfo.roomName && (
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Room Name</p>
                  <p className="text-lg font-semibold text-zinc-100">{roomInfo.roomName}</p>
                </div>
              )}
              {roomInfo.description && (
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-zinc-300">{roomInfo.description}</p>
                </div>
              )}
              {roomInfo.lang && (
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Language</p>
                  <p className="text-sm font-mono text-indigo-400">{roomInfo.lang}</p>
                </div>
              )}
            </div>

            {user && (
              <div className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-green-300">✓ Signed in as <span className="font-semibold">{user.name}</span></p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors disabled:opacity-50"
                disabled={joining || authLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={joining || authLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {joining ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Joining...
                  </>
                ) : authLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Loading...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Join Room
                  </>
                )}
              </button>
            </div>

            {!user && (
              <p className="text-xs text-zinc-400 text-center mt-4">
                Click "Join Room" to sign in and then you'll be taken to the room
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

