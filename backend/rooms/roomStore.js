// room metadata
const roomLang = new Map();

function getRoomLang(roomId) {
  if (!roomLang.has(roomId)) roomLang.set(roomId, "js");
  return roomLang.get(roomId);
}

function setRoomLang(roomId, lang) {
  roomLang.set(roomId, lang);
  return lang;
}

module.exports = { getRoomLang, setRoomLang };
