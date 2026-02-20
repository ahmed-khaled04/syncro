import { io } from "socket.io-client";

const BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export const socket = io(BASE, {
  transports: ["websocket"],
  auth: {
    token: localStorage.getItem("syncro-token"),
  },
});