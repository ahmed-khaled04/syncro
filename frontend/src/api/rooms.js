const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const roomsAPI = {
  getToken() {
    return localStorage.getItem("syncro-token");
  },

  async getMyRooms() {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/rooms/my-rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch rooms");
    }

    const data = await response.json();
    return data.rooms;
  },

  async createRoom(roomName) {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ roomName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create room");
    }

    const data = await response.json();
    return data.room;
  },

  async joinRoom(roomId) {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to join room");
    }

    const data = await response.json();
    return data.room;
  },

  async deleteRoom(roomId) {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete room");
    }

    return await response.json();
  },
};
