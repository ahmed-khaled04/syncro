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

  async createRoom(roomName, description = "") {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        roomName,
        description: description || undefined
      }),
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

  async checkRoomAvailability(roomId) {
    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/availability`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Room not found");
      }

      const data = await response.json();
      return data;
    } catch (err) {
      throw new Error(err.message);
    }
  },

  async updateRoom(roomId, updates) {
    const token = this.getToken();
    const url = `${API_BASE_URL}/rooms/${roomId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update room");
    }

    const data = await response.json();
    return data;
  },

  async deleteRoom(roomId) {
    const token = this.getToken();
    const url = `${API_BASE_URL}/rooms/${roomId}`;
    
    console.log(`🗑️ Deleting room: ${roomId}`);
    console.log(`📍 DELETE URL: ${url}`);
    console.log(`🔐 Token present: ${!!token}`);
    
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`📊 Response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Delete failed:`, error);
      throw new Error(error.error || "Failed to delete room");
    }

    const data = await response.json();
    console.log(`✅ Room deleted:`, data);
    return data;
  },
};
