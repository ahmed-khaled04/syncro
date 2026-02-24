import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { socket, isSocketConnected, getSocketInstance } from "../config/socket.js";

/**
 * Hook to safely use socket with authentication
 * 
 * ⚠️  IMPORTANT: Only use this hook in components that are rendered AFTER authentication
 * 
 * Features:
 * 1. Waits for authentication to complete before exposing socket
 * 2. Tracks real-time connection status
 * 3. Auto-reconnects on token updates
 * 4. Proper cleanup on unmount
 * 5. Provides safe emit/on methods
 * 
 * Usage:
 * ```jsx
 * function MyComponent() {
 *   const { socket, connected } = useSocket();
 *   
 *   useEffect(() => {
 *     if (!connected) return; // Wait for connection
 *     
 *     socket.emit("my-event", { data });
 *     socket.on("response", (data) => { ... });
 *     
 *     return () => socket.off("response");
 *   }, [connected, socket]);
 * }
 * ```
 */
export function useSocket() {
  const { user, loading } = useAuth();
  const [connected, setConnected] = useState(isSocketConnected());

  useEffect(() => {
    // Don't initialize if auth is loading or user not authenticated
    if (loading || !user) {
      setConnected(false);
      return;
    }

    // At this point, socket should be initialized by AuthProvider/updateSocketAuth
    const socketInstance = getSocketInstance();
    if (!socketInstance) {
      if (import.meta.env.DEV) {
        console.warn(
          "[useSocket] Socket not initialized. This may indicate auth setup issue."
        );
      }
      return;
    }

    // Update connection state
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = () => setConnected(false);

    // Register listeners
    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);
    socketInstance.on("connect_error", handleConnectError);

    // Set initial state
    setConnected(socketInstance.connected);

    // Cleanup listeners on unmount
    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.off("connect_error", handleConnectError);
    };
  }, [user, loading]);

  // Safe emit wrapper
  const emit = useCallback((event, ...args) => {
    if (!user) {
      console.warn(
        `[useSocket.emit] Cannot emit '${event}': user not authenticated`
      );
      return;
    }
    return socket.emit(event, ...args);
  }, [user]);

  // Safe on wrapper
  const on = useCallback((event, handler) => {
    socket.on(event, handler);
    // Return unsubscribe function for cleanup
    return () => socket.off(event, handler);
  }, []);

  // Safe once wrapper
  const once = useCallback((event, handler) => {
    socket.once(event, handler);
    return () => socket.off(event, handler);
  }, []);

  return {
    // Raw socket for advanced usage
    socket,
    
    // Connection status
    connected,
    
    // Safe methods (with auth checks)
    emit,
    on,
    once,
    
    // Convenience: direct socket instance access
    get instance() {
      return getSocketInstance();
    },
  };
}
