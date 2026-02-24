/**
 * Room Service - Handles all room-related API operations
 */

import { apiClient } from "../client.js";

export const roomService = {
  /**
   * Get all rooms for the current user
   */
  async getMyRooms() {
    const data = await apiClient.get("/rooms/my-rooms");
    return data.rooms || [];
  },

  /**
   * Create a new room
   */
  async createRoom(roomName, description = "") {
    const data = await apiClient.post("/rooms", {
      roomName,
      description: description || undefined,
    });
    return data.room;
  },

  /**
   * Join a room (with optional invite token)
   */
  async joinRoom(roomId, inviteToken = null) {
    const body = inviteToken ? { inviteToken } : {};
    const data = await apiClient.post(`/rooms/${roomId}/join`, body);
    return data.room;
  },

  /**
   * Check if room owner is online
   */
  async checkRoomAvailability(roomId) {
    return await apiClient.get(`/rooms/${roomId}/availability`);
  },

  /**
   * Update room settings
   */
  async updateRoom(roomId, updates) {
    const data = await apiClient.put(`/rooms/${roomId}`, updates);
    return data;
  },

  /**
   * Delete a room
   */
  async deleteRoom(roomId) {
    const data = await apiClient.delete(`/rooms/${roomId}`);
    return data;
  },

  /**
   * Create an invite link
   */
  async createInvite(roomId, expiresInMinutes = null) {
    const data = await apiClient.post(`/rooms/${roomId}/invites`, {
      expiresInMinutes,
    });
    return data.invite;
  },

  /**
   * List all invites for a room
   */
  async listInvites(roomId) {
    const data = await apiClient.get(`/rooms/${roomId}/invites`);
    return data.invites || [];
  },

  /**
   * Revoke an invite
   */
  async revokeInvite(inviteToken) {
    const data = await apiClient.post(
      `/rooms/invites/${inviteToken}/revoke`,
      {}
    );
    return data;
  },

  /**
   * Validate an invite token
   */
  async validateInvite(roomId, inviteToken) {
    const params = new URLSearchParams({
      roomId,
      token: inviteToken,
    }).toString();
    return await apiClient.get(`/rooms/invites/validate?${params}`);
  },

  /**
   * List join requests for a room (owner only)
   */
  async listJoinRequests(roomId) {
    const data = await apiClient.get(`/rooms/${roomId}/join-requests`);
    return data.requests || data || [];
  },

  /**
   * Accept a join request
   */
  async acceptJoinRequest(roomId, requesterId) {
    const data = await apiClient.post(
      `/rooms/${roomId}/join-requests/${requesterId}/accept`,
      {}
    );
    return data;
  },

  /**
   * Decline a join request
   */
  async declineJoinRequest(roomId, requesterId) {
    const data = await apiClient.post(
      `/rooms/${roomId}/join-requests/${requesterId}/decline`,
      {}
    );
    return data;
  },

  /**
   * Check the current user's join request status
   */
  async checkJoinRequestStatus(roomId) {
    const data = await apiClient.get(
      `/rooms/${roomId}/join-request-status`
    );
    return data; // { status: 'pending' | 'accepted' | 'declined' | null }
  },

};
