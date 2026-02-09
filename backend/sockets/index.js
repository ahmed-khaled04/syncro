const { registerRoomHandlers } = require("./handlers/roomHandlers");
const { registerYjsHandlers } = require("./handlers/yjsHandlers");

function registerSocketServer(io) {
  io.on("connection", (socket) => {
    console.log("✅ connected:", socket.id);

    registerRoomHandlers(io, socket);
    registerYjsHandlers(io, socket);

    socket.on("disconnect", () => {
      console.log("❌ disconnected:", socket.id);
    });
  });
}

module.exports = { registerSocketServer };
