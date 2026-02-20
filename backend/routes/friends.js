// routes/friends.js
const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
    findUserByEmail,
    sendRequest,
    getIncoming,
    getOutgoing,
    respondToRequest,
    listFriends,
    areFriends,
    removeFriend,
    upsertJoinRequest,
} = require("../persistence/friendsRepo");

const rateLimit = require("express-rate-limit");

const { ipKeyGenerator } = require("express-rate-limit");

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user?.id) return `u:${req.user.id}`;
    return `ip:${ipKeyGenerator(req)}`;
  },

  message: { error: "Too many searches. Try again in a minute." },
});

function createFriendsRoutes(pool) {
    const router = express.Router();
    router.use(authMiddleware);

    // ── Search user by email ─────────────────────────────────────────
    router.get("/search", searchLimiter, async (req, res) => {
        const { email } = req.query;

        if (!email) return res.status(200).json({ user: null });

        try {
            const trimmed = String(email).trim();


            const user = await findUserByEmail(pool, trimmed);

            if (!user) return res.status(200).json({ user: null });

            if (user.id === req.user.id) return res.status(200).json({ user: null });

            return res.status(200).json({ user });
        } catch (e) {
            console.error("friends/search error:", e);

            return res.status(200).json({ user: null });
        }
        });

    // ── Send friend request ──────────────────────────────────────────
    router.post("/requests", async (req, res) => {
        const { addresseeEmail } = req.body;
        if (!addresseeEmail) return res.status(400).json({ error: "addresseeEmail required" });

        try {
            const addressee = await findUserByEmail(pool, addresseeEmail.trim());
            if (!addressee) return res.status(404).json({ error: "No user with that email" });
            if (addressee.id === req.user.id) return res.status(400).json({ error: "Cannot friend yourself" });

            // check not already friends or request pending
            const already = await areFriends(pool, req.user.id, addressee.id);
            if (already) return res.status(400).json({ error: "Already friends" });

            await sendRequest(pool, req.user.id, addressee.id);
            res.json({ ok: true, addressee: { id: addressee.id, name: addressee.name } });
        } catch (e) {
            console.error("friends/requests POST error:", e);
            res.status(500).json({ error: "Failed to send request" });
        }
    });

    // ── Incoming pending requests ────────────────────────────────────
    router.get("/requests/incoming", async (req, res) => {
        try {
            const requests = await getIncoming(pool, req.user.id);
            res.json({ requests });
        } catch (e) {
            console.error("friends/requests/incoming error:", e);
            res.status(500).json({ error: "Failed to get requests" });
        }
    });

    // ── Outgoing pending requests ────────────────────────────────────
    router.get("/requests/outgoing", async (req, res) => {
        try {
            const requests = await getOutgoing(pool, req.user.id);
            res.json({ requests });
        } catch (e) {
            console.error("friends/requests/outgoing error:", e);
            res.status(500).json({ error: "Failed to get requests" });
        }
    });

    // ── Accept request ───────────────────────────────────────────────
    router.post("/requests/:requesterId/accept", async (req, res) => {
        const requesterId = parseInt(req.params.requesterId, 10);
        if (isNaN(requesterId)) return res.status(400).json({ error: "Invalid requesterId" });

        try {
            await respondToRequest(pool, requesterId, req.user.id, "accepted");
            res.json({ ok: true });
        } catch (e) {
            console.error("friends accept error:", e);
            res.status(500).json({ error: "Failed to accept" });
        }
    });

    // ── Decline request ──────────────────────────────────────────────
    router.post("/requests/:requesterId/decline", async (req, res) => {
        const requesterId = parseInt(req.params.requesterId, 10);
        if (isNaN(requesterId)) return res.status(400).json({ error: "Invalid requesterId" });

        try {
            await respondToRequest(pool, requesterId, req.user.id, "declined");
            res.json({ ok: true });
        } catch (e) {
            console.error("friends decline error:", e);
            res.status(500).json({ error: "Failed to decline" });
        }
    });

    // ── List accepted friends ────────────────────────────────────────
    router.get("/", async (req, res) => {
        try {
            const friends = await listFriends(pool, req.user.id);
            res.json({ friends });
        } catch (e) {
            console.error("friends list error:", e);
            res.status(500).json({ error: "Failed to list friends" });
        }
    });

    // ── Remove friend ────────────────────────────────────────────────
    router.delete("/:friendId", async (req, res) => {
        const friendId = parseInt(req.params.friendId, 10);
        if (isNaN(friendId)) return res.status(400).json({ error: "Invalid friendId" });

        try {
            await removeFriend(pool, req.user.id, friendId);
            res.json({ ok: true });
        } catch (e) {
            console.error("friends remove error:", e);
            res.status(500).json({ error: "Failed to remove friend" });
        }
    });

    // ── Request to join a friend's private room ──────────────────────
    // This stores the request in DB; the socket layer notifies the room owner.
    router.post("/rooms/:roomId/join-request", async (req, res) => {
        const { roomId } = req.params;

        try {
            await upsertJoinRequest(pool, roomId, req.user.id);
            res.json({ ok: true });
        } catch (e) {
            console.error("join-request error:", e);
            res.status(500).json({ error: "Failed to submit join request" });
        }
    });

    return router;
}

module.exports = createFriendsRoutes;
