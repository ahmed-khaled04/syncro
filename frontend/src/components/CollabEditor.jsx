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

export default function CollabEditor({
  lang,
  fileId,          //REQUIRED: used to remount editor
  ytext,
  awareness,
  readOnly = false,
}) {
  const typingTimerRef = useRef(null);

  //keep one UndoManager per file (per ytext)
  const undoRef = useRef(null);
  useEffect(() => {
    if (!ytext) return;
    undoRef.current = new Y.UndoManager(ytext);
    return () => {
      try {
        undoRef.current?.destroy?.();
      } catch {}
      undoRef.current = null;
    };
  }, [ytext]);

  useEffect(() => {
    if (!awareness) return;

    awareness.setLocalStateField("editing", false);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      try {
        awareness.setLocalStateField("editing", false);
      } catch {}
    };
  }, [awareness, fileId]);

  const extensions = useMemo(() => {
    const langExt = LANGS[lang]?.ext ? LANGS[lang].ext() : LANGS.js.ext();

    return [
      langExt,
      presenceTheme,
      editorPadding,
      EditorView.editable.of(!readOnly),

      yCollab(ytext, awareness, {
        undoManager: undoRef.current || new Y.UndoManager(ytext),
      }),
    ];
  }, [lang, ytext, awareness, readOnly]);

  const onChange = (_value, viewUpdate) => {
    if (!awareness) return;
    if (readOnly) return;

    const isUserTyping = viewUpdate?.transactions?.some(
      (tr) =>
        tr.isUserEvent("input") ||
        tr.isUserEvent("delete") ||
        tr.isUserEvent("paste")
    );

    if (!isUserTyping) return;

    awareness.setLocalStateField("editing", true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      try {
        awareness.setLocalStateField("editing", false);
      } catch {}
    }, 900);
  };

  // ✅ Extract initial content from Y.Text so CodeMirror displays it on mount
  const initialContent = ytext ? ytext.toString() : "";

  return (
    <CodeMirror
      key={fileId || "no-file"}
      height="420px"
      theme={oneDark}
      value={initialContent}
      extensions={extensions}
      onChange={onChange}
    />
  );
}
