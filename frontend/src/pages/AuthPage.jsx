import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { signup, login } = useAuth();

  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [roomForm, setRoomForm] = useState({
    roomId: "",
    name: "",
  });

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (signupForm.password !== signupForm.confirmPassword) {
        throw new Error("Passwords don't match");
      }

      await signup(
        signupForm.email,
        signupForm.password,
        signupForm.name,
        signupForm.confirmPassword
      );
      setMode("login");
      setSignupForm({ email: "", password: "", confirmPassword: "", name: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(loginForm.email, loginForm.password);
      setMode("join");
      setLoginForm({ email: "", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomForm.roomId.trim()) {
      setError("Room ID is required");
      return;
    }

    navigate(`/room/${roomForm.roomId}`, {
      state: { name: roomForm.name || "Anonymous" },
    });
  };

  const handleLogout = () => {
    setMode("login");
    setLoginForm({ email: "", password: "" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 overflow-hidden">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-[520px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative w-full max-w-sm px-4">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Syncro</h1>
          <p className="text-sm text-zinc-400">Real-time Collaborative Editor</p>
        </div>

        {/* Auth Forms */}
        {mode === "login" && (
          <form
            onSubmit={handleLogin}
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur"
          >
            <div>
              <h2 className="text-xl font-semibold">Welcome Back</h2>
              <p className="mt-1 text-xs text-zinc-400">Sign in to your account</p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-900/40 px-2 text-zinc-500">New to Syncro?</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode("signup")}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-800/20 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800/40 transition"
            >
              Create an Account
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form
            onSubmit={handleSignup}
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur"
          >
            <div>
              <h2 className="text-xl font-semibold">Create Account</h2>
              <p className="mt-1 text-xs text-zinc-400">Join Syncro today</p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Full Name</label>
              <input
                type="text"
                value={signupForm.name}
                onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                placeholder="John Doe"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Email</label>
              <input
                type="email"
                value={signupForm.email}
                onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Password</label>
              <input
                type="password"
                value={signupForm.password}
                onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Confirm Password</label>
              <input
                type="password"
                value={signupForm.confirmPassword}
                onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-900/40 px-2 text-zinc-500">Already have an account?</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-800/20 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800/40 transition"
            >
              Sign In Instead
            </button>
          </form>
        )}

        {mode === "join" && (
          <form
            onSubmit={handleJoinRoom}
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur"
          >
            <div>
              <h2 className="text-xl font-semibold">Join a Room</h2>
              <p className="mt-1 text-xs text-zinc-400">Start collaborating</p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Display Name (Optional)</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="Your nickname in the room"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Room ID</label>
              <input
                type="text"
                value={roomForm.roomId}
                onChange={(e) => setRoomForm({ ...roomForm, roomId: e.target.value })}
                placeholder="e.g. abc123"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRoomForm({ ...roomForm, roomId: generateRoomId() })}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Generate
              </button>

              <button
                type="submit"
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500 transition"
              >
                Join Room
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-800/20 px-4 py-2.5 text-sm font-medium hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-100 transition"
            >
              Sign Out
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
