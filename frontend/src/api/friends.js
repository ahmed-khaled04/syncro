// api/friends.js — frontend API module for the friends system
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
    return localStorage.getItem("syncro-token");
}

function authHeaders(extra = {}) {
    return { Authorization: `Bearer ${getToken()}`, ...extra };
}

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}/friends${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

export const friendsAPI = {
    /** Find a user by exact email */
    searchByEmail(email) {
        return request(`/search?email=${encodeURIComponent(email)}`, {
            headers: authHeaders(),
        });
    },

    /** Send a friend request */
    sendRequest(addresseeEmail) {
        return request("/requests", {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ addresseeEmail }),
        });
    },

    /** Incoming pending requests */
    getIncoming() {
        return request("/requests/incoming", { headers: authHeaders() });
    },

    /** Outgoing pending requests */
    getOutgoing() {
        return request("/requests/outgoing", { headers: authHeaders() });
    },

    /** Accept a friend request by the requester's user id */
    acceptRequest(requesterId) {
        return request(`/requests/${requesterId}/accept`, {
            method: "POST",
            headers: authHeaders(),
        });
    },

    /** Decline a friend request */
    declineRequest(requesterId) {
        return request(`/requests/${requesterId}/decline`, {
            method: "POST",
            headers: authHeaders(),
        });
    },

    /** Get accepted friends list */
    listFriends() {
        return request("/", { headers: authHeaders() });
    },

    /** Remove a friend */
    removeFriend(friendId) {
        return request(`/${friendId}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
    },

    /** Submit a join-request for a private room */
    requestJoinRoom(roomId) {
        return request(`/rooms/${roomId}/join-request`, {
            method: "POST",
            headers: authHeaders(),
        });
    },
};
