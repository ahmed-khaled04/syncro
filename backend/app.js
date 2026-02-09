const express = require("express");
const cors = require("cors");
const { corsOptions } = require("./config/cors");

function createApp() {
  const app = express();
  app.use(cors(corsOptions()));
  return app;
}

module.exports = { createApp };
