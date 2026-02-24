import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

// ============================================================================
// PRODUCTION-READY SOCKET INITIALIZATION WITH AUTH SYNCHRONIZATION
// ============================================================================
// 
// CRITICAL: Socket is NOT created at module import time.
// This prevents connecting without authentication.
//
// Socket lifecycle:
// 1. Module loads → socketInstance = null
// 2. User logs in → authService.login() → updateSocketAuth(token)
// 3. updateSocketAuth() creates socket with token and connects
// 4. User logs out → disconnectSocket() → destroys socket instance
//
// ============================================================================

let socketInstance = null;

/**
 * Get or create socket instance with current auth token
 * 
 * IMPORTANT: Only call this AFTER user is authenticated!
 * Automatically called by updateSocketAuth() and AuthProvider
 */
function getSocket() {
  const token = localStorage.getItem("syncro-token");
  
  // Socket doesn't exist yet - create it with current token
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      auth: {
        token: token || null,
      },
    });

    // Development logging
    if (import.meta.env.DEV) {
      socketInstance.on("connect", () => {
        console.log("✅ Socket connected:", socketInstance.id);
      });
      socketInstance.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error.message);
      });
      socketInstance.on("disconnect", (reason) => {
        console.warn("⚠️  Socket disconnected:", reason);
      });
    }
  }
  
  return socketInstance;
}

/**
 * Update socket auth token and reconnect if needed
 * 
 * CALL THIS after successful login/registration
 * Example: updateSocketAuth(token) after user.login()
 * 
 * Steps:
 * 1. Ensures socket is created
 * 2. Updates auth with new token
 * 3. Reconnects if already connected
 */
function updateSocketAuth(token) {
  // Create socket if it doesn't exist
  if (!socketInstance) {
    if (import.meta.env.DEV) {
      console.log("🔌 Creating socket with token...");
    }
    getSocket();
  }

  // Update auth for reconnection
  socketInstance.auth = { token };

  // If already connected, reconnect with new token
  if (socketInstance.connected) {
    if (import.meta.env.DEV) {
      console.log("🔄 Reconnecting socket with new token...");
    }
    socketInstance.disconnect();
    socketInstance.connect();
  } else {
    // Connect with new token
    if (import.meta.env.DEV) {
      console.log("🔌 Connecting socket with token...");
    }
    socketInstance.connect();
  }
}

/**
 * Disconnect socket and clear instance
 * 
 * CALL THIS on logout
 */
function disconnectSocket() {
  if (socketInstance) {
    if (import.meta.env.DEV) {
      console.log("❌ Disconnecting socket...");
    }
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Check if socket is connected
 */
function isSocketConnected() {
  return socketInstance?.connected ?? false;
}

/**
 * Get socket instance directly (for advanced use)
 * Returns null if socket not initialized
 */
function getSocketInstance() {
  return socketInstance;
}

/**
 * Smart socket proxy - handles lazy initialization with auth
 * 
 * This proxy ensures socket operations are safe even if socket
 * is created after component mounts.
 * 
 * Usage:
 * - import { socket } from './config/socket'
 * - socket.connected → getter that returns current connection state
 * - socket.emit(...) → proxies to real socket
 * - socket.on(...) → proxies to real socket
 * - socket.instance → direct access to socket for advanced use
 */
const socketProxy = {
  // Connection status getter
  get connected() {
    return socketInstance?.connected ?? false;
  },

  // Event listener
  on(event, handler) {
    if (!socketInstance) {
      console.warn(
        `⚠️  Socket not initialized. Event '${event}' may not work.` +
        " Ensure user is authenticated before using socket."
      );
      return () => {}; // Return no-op unsubscribe
    }
    return socketInstance.on(event, handler);
  },

  // Event emitter
  emit(event, ...args) {
    if (!socketInstance) {
      console.warn(
        `⚠️  Socket not initialized. Cannot emit '${event}'.` +
        " Ensure user is authenticated before using socket."
      );
      return undefined;
    }
    return socketInstance.emit(event, ...args);
  },

  // Event unlistener
  off(event, handler) {
    if (!socketInstance) {
      return () => {};
    }
    return socketInstance.off(event, handler);
  },

  // One-time event listener
  once(event, handler) {
    if (!socketInstance) {
      console.warn(
        `⚠️  Socket not initialized. Event '${event}' may not work.` +
        " Ensure user is authenticated before using socket."
      );
      return () => {};
    }
    return socketInstance.once(event, handler);
  },

  // Direct access to instance for advanced use
  get instance() {
    return socketInstance;
  },

  // Manual socket control
  connect() {
    if (socketInstance) {
      socketInstance.connect();
    }
  },

  disconnect() {
    if (socketInstance) {
      socketInstance.disconnect();
    }
  },
};

export {
  socketProxy as socket,
  getSocket,
  updateSocketAuth,
  disconnectSocket,
  isSocketConnected,
  getSocketInstance,
  SOCKET_URL,
};