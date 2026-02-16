const crypto = require("crypto");

function createInviteRepo(pool) {

  async function createInvite({ roomId, createdBy, expiresAt }) {
    const token = crypto.randomBytes(16).toString("hex");

    await pool.query(
      `
      INSERT INTO room_invites (room_id, token, created_by, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [roomId, token, createdBy, expiresAt || null]
    );

    return token;
  }

  async function validateInvite(roomId, token) {
    const res = await pool.query(
      `
      SELECT *
      FROM room_invites
      WHERE room_id = $1
        AND token = $2
        AND revoked = FALSE
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
      `,
      [roomId, token]
    );

    return res.rowCount ? res.rows[0] : null;
  }

  async function revokeInvite(token) {
    await pool.query(
      `
      UPDATE room_invites
      SET revoked = TRUE
      WHERE token = $1
      `,
      [token]
    );
  }

  return {
    createInvite,
    validateInvite,
    revokeInvite,
  };
}

module.exports = { createInviteRepo };
