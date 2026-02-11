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

export default function CollabEditor({ lang, ytext, awareness, readOnly = false }) {
  const typingTimerRef = useRef(null);

  useEffect(() => {
    if (!awareness) return;

    // always reset typing on mount/change
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
      EditorView.editable.of(!readOnly),
      yCollab(ytext, awareness, {
        undoManager: new Y.UndoManager(ytext),
      }),
    ];
  }, [lang, ytext, awareness, readOnly]);

  const onChange = (_value, viewUpdate) => {
    if (!awareness) return;
    if (readOnly) return; // ✅ viewers never “type”

    const isUserTyping = viewUpdate?.transactions?.some((tr) =>
      tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("paste")
    );

    if (!isUserTyping) return;

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
