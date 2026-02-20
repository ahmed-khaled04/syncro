// server/src/sockets/index.js
const { registerRoomHandlers } = require("./handlers/roomHandlers");
const { registerYjsHandlers } = require("./handlers/yjsHandlers");
const { registerFriendsHandlers } = require("./handlers/friendsHandlers");

function registerSocketServer(io, pool) {
  io.on("connection", (socket) => {
    console.log("✅ connected:", socket.id, "userId:", socket.data.userId);

    registerRoomHandlers(io, socket , pool);
    registerYjsHandlers(io, socket);
    registerFriendsHandlers(io, socket, pool);

    socket.on("disconnect", () => {
      console.log("❌ disconnected:", socket.id);
    });
  });
}

module.exports = { registerSocketServer };
