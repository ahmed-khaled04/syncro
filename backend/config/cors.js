const { CLIENT_ORIGIN } = require("./env");

// backend/config/cors.js
function corsOptions() {
  return {
    origin: "http://localhost:5173",
    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

module.exports = { corsOptions };
