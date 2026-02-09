import { useEffect, useState } from "react";

export function useRoomLanguage(socket, roomId, initial = "js") {
  const [lang, setLang] = useState(initial);

  useEffect(() => {
    const onRoomLanguage = ({ roomId: rid, lang: newLang }) => {
      if (rid === roomId) setLang(newLang);
    };
    socket.on("room-language", onRoomLanguage);
    return () => socket.off("room-language", onRoomLanguage);
  }, [socket, roomId]);

  const setRoomLanguage = (newLang) => {
    socket.emit("set-room-language", { roomId, lang: newLang });
  };

  return { lang, setRoomLanguage };
}
