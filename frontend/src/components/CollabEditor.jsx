import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import { LANGS } from "../constants/langs";

export default function CollabEditor({ lang, ytext, awareness }) {
  const extensions = useMemo(() => {
    const langExt = LANGS[lang]?.ext ? LANGS[lang].ext() : LANGS.js.ext();
    return [langExt, yCollab(ytext, awareness, { undoManager: new Y.UndoManager(ytext) })];
  }, [lang, ytext, awareness]);

  return <CodeMirror height="420px" theme={oneDark} extensions={extensions} />;
}
