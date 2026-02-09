import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";

export const LANGS = {
  js: { label: "JavaScript", ext: () => javascript() },
  py: { label: "Python", ext: () => python() },
  cpp: { label: "C++", ext: () => cpp() },
  html: { label: "HTML", ext: () => html() },
};
