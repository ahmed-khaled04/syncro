/**
 * Friends Service - Handles all friends-related API operations
 */

import { apiClient } from "../client.js";

export const friendsService = {
  /**
   * Search for a user by email
   */
  async searchByEmail(email) {
    const data = await apiClient.get(`/friends/search?email=${encodeURIComponent(email)}`);
    return data;
  },

  /**
   * Send a friend request
   */
  async sendRequest(addresseeEmail) {
    const data = await apiClient.post("/friends/requests", {
      addresseeEmail,
    });
    return data;
  },

  /**
   * Get incoming friend requests
   */
  async getIncoming() {
    const data = await apiClient.get("/friends/requests/incoming");
    return data;
  },

  /**
   * Get outgoing friend requests
   */
  async getOutgoing() {
    const data = await apiClient.get("/friends/requests/outgoing");
    return data;
  },

  /**
   * Accept a friend request
   */
  async acceptRequest(requesterId) {
    const data = await apiClient.post(
      `/friends/requests/${requesterId}/accept`,
      {}
    );
    return data;
  },

  /**
   * Decline a friend request
   */
  async declineRequest(requesterId) {
    const data = await apiClient.post(
      `/friends/requests/${requesterId}/decline`,
      {}
    );
    return data;
  },

  /**
   * Get list of friends
   */
  async getFriends() {
    const data = await apiClient.get("/friends");
    return data; // Returns { friends: [...] }
  },

  /**
   * Alias for backwards compatibility
   */
  listFriends() {
    return this.getFriends();
  },

  /**
   * Remove a friend
   */
  async removeFriend(friendId) {
    const data = await apiClient.delete(`/friends/${friendId}`);
    return data;
  },

  /**
   * Block a user
   */
  async blockUser(userId) {
    const data = await apiClient.post(`/friends/block/${userId}`, {});
    return data;
  },

  /**
   * Unblock a user
   */
  async unblockUser(userId) {
    const data = await apiClient.post(`/friends/unblock/${userId}`, {});
    return data;
  },

  /**
   * Get blocked users
   */
  async getBlocked() {
    const data = await apiClient.get("/friends/blocked");
    return data.blocked || [];
  },

  /**
   * Request to join a private room
   */
  async requestJoinRoom(roomId) {
    const data = await apiClient.post(`/friends/rooms/${roomId}/join-request`, {});
    return data;
  },
};


