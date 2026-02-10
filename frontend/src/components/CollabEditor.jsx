import { useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import { LANGS } from "../constants/langs";
import { EditorView } from "@codemirror/view";

const presenceTheme = EditorView.baseTheme({
  ".cm-ySelection": { borderRadius: "3px" },
  ".cm-ySelectionCaret": {
    borderLeftWidth: "2px",
    borderLeftStyle: "solid",
    marginLeft: "-1px",
    marginRight: "-1px",
  },
  ".cm-ySelectionCaretDot": {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    position: "absolute",
    top: "-2px",
    left: "-4px",
  },
  ".cm-ySelectionInfo": {
    position: "absolute",
    top: "-1.4em",
    left: "-1px",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    userSelect: "none",
    boxShadow: "0 6px 18px rgba(0,0,0,.35)",
  },
});

const editorPadding = EditorView.theme({
  ".cm-content": {
    paddingTop: "16px",
    paddingBottom: "16px",
  },
});

export default function CollabEditor({ lang, ytext, awareness }) {
  const typingTimerRef = useRef(null);

  // Ensure typing resets if component unmounts / room changes
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField("typing", false);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      try {
        awareness.setLocalStateField("typing", false);
      } catch {}
    };
  }, [awareness]);

  const extensions = useMemo(() => {
    const langExt = LANGS[lang]?.ext ? LANGS[lang].ext() : LANGS.js.ext();

    return [
      langExt,
      presenceTheme,
      editorPadding,
      yCollab(ytext, awareness, {
        undoManager: new Y.UndoManager(ytext),
      }),
    ];
  }, [lang, ytext, awareness]);

  const onChange = (_value, viewUpdate) => {
    if (!awareness) return;

    // ✅ Only treat as "typing" if the transaction is a user action
    const isUserTyping = viewUpdate?.transactions?.some((tr) =>
      tr.isUserEvent("input") ||
      tr.isUserEvent("delete") ||
      tr.isUserEvent("paste") ||
      tr.isUserEvent("move") ||
      tr.isUserEvent("select")
    );

    if (!isUserTyping) return; // <-- ignore remote updates

    awareness.setLocalStateField("typing", true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      try {
        awareness.setLocalStateField("typing", false);
      } catch {}
    }, 900);
  };


  return (
    <CodeMirror
      height="420px"
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
    />
  );
}
