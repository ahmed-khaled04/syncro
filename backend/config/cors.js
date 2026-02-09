const { CLIENT_ORIGIN } = require("./env");

function corsOptions() {
  return { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] };
}

module.exports = { corsOptions };
