import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";

const LANGUAGE_OPTIONS = [
  { id: "js", label: "JavaScript", ext: () => javascript() },
  { id: "py", label: "Python", ext: () => python() },
  { id: "cpp", label: "C++", ext: () => cpp() },
  { id: "html", label: "HTML", ext: () => html() },
];

export default function Editor() {
  const [lang, setLang] = useState("js");
  const [value, setValue] = useState("// Type here...\n");

  // Swap language extensions without touching collaboration logic later
  const extensions = useMemo(() => {
    const found = LANGUAGE_OPTIONS.find((l) => l.id === lang);
    return found ? [found.ext()] : [];
  }, [lang]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <label>
          Language:{" "}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CodeMirror
        value={value}
        height="350px"
        theme={oneDark}
        extensions={extensions}
        onChange={(val) => setValue(val)}
      />
    </div>
  );
}
