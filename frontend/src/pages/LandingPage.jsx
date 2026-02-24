import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Syncro
          </div>
          <button
            onClick={() => navigate("/?mode=login")}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium transition-all duration-300 transform hover:scale-105"
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-4 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"
            style={{ transform: `translateY(${scrollY * 0.5}px)` }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl"
            style={{ transform: `translateY(${-scrollY * 0.3}px)` }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="mb-6 inline-block">
            <div className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium animate-pulse">
              ✨ The future of collaborative coding
            </div>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="block">Code Together,</span>
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent animate-pulse">
              Create Better
            </span>
          </h1>

          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Real-time collaborative editor with live syntax highlighting, instant synchronization, and seamless room management. Perfect for pair programming and team development.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => navigate("/?mode=signup")}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-indigo-500/50"
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate("/?mode=login")}
              className="px-8 py-4 rounded-xl border-2 border-indigo-500/50 hover:border-indigo-500 text-indigo-300 hover:text-indigo-200 font-semibold text-lg transition-all duration-300"
            >
              Sign In
            </button>
          </div>

          {/* Demo stats */}
          <div className="grid grid-cols-3 gap-6 mt-16 pt-16 border-t border-zinc-800/50">
            <div className="group">
              <div className="text-4xl font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                ∞
              </div>
              <p className="text-zinc-400 mt-2">Rooms</p>
            </div>
            <div className="group">
              <div className="text-4xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                ⚡
              </div>
              <p className="text-zinc-400 mt-2">Real-time Sync</p>
            </div>
            <div className="group">
              <div className="text-4xl font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                🚀
              </div>
              <p className="text-zinc-400 mt-2">Instant Share</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Powerful Features
          </h2>
          <p className="text-center text-zinc-400 mb-16 max-w-2xl mx-auto">
            Everything you need for seamless collaborative development
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "⚡",
                title: "Real-time Collaboration",
                desc: "Edit code simultaneously with instant synchronization across all editors",
              },
              {
                icon: "🎨",
                title: "Syntax Highlighting",
                desc: "Beautiful code highlighting for JavaScript, Python, Java, and more",
              },
              {
                icon: "👥",
                title: "Smart Room Management",
                desc: "Create public rooms, send invites, and manage permissions with ease",
              },
              {
                icon: "📱",
                title: "Friend System",
                desc: "Build your network, see who's online, and jump into their rooms",
              },
              {
                icon: "🔐",
                title: "Secure & Private",
                desc: "Control room access with join requests and invite-only options",
              },
              {
                icon: "💾",
                title: "Session History",
                desc: "Restore previous versions of your code with snapshot management",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 rounded-2xl bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 border border-zinc-700/50 hover:border-indigo-500/50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10"
              >
                <div className="text-4xl mb-4 group-hover:scale-125 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-zinc-100">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            How It Works
          </h2>

          <div className="space-y-12">
            {[
              {
                step: "1",
                title: "Create or Join",
                desc: "Start a new room or join an existing one with an invite link",
                color: "indigo",
              },
              {
                step: "2",
                title: "Code Together",
                desc: "See real-time edits from your team as they type, with live cursor tracking",
                color: "cyan",
              },
              {
                step: "3",
                title: "Sync Instantly",
                desc: "All changes synchronize automatically across all connected editors",
                color: "indigo",
              },
              {
                step: "4",
                title: "Collaborate Smarter",
                desc: "Use snapshots to save versions, manage permissions, and share easily",
                color: "cyan",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-8 items-center group"
                style={{
                  transform: `translateX(${Math.sin(scrollY / 100 + i) * 20}px)`,
                }}
              >
                <div
                  className={`flex-shrink-0 w-20 h-20 rounded-2xl bg-${item.color}-500/20 border border-${item.color}-500/50 flex items-center justify-center`}
                >
                  <span className={`text-3xl font-bold text-${item.color}-400`}>
                    {item.step}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-3 group-hover:text-indigo-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-zinc-400 text-lg">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-900/40 to-cyan-900/40 border border-indigo-500/30 p-12 text-center backdrop-blur">
            <h2 className="text-4xl font-bold mb-6">
              Ready to Code Together?
            </h2>
            <p className="text-zinc-300 text-lg mb-8 max-w-2xl mx-auto">
              Join developers worldwide using Syncro for real-time collaboration. Start coding with your team in seconds.
            </p>
            <button
              onClick={() => navigate("/?mode=signup")}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-indigo-500/50"
            >
              Create Free Account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-12 px-4 relative z-10">
        <div className="max-w-6xl mx-auto text-center text-zinc-500">
          <p>© 2026 Syncro. Built for developers, by developers.</p>
        </div>
      </footer>
    </div>
  );
}
