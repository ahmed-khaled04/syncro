// Map of file extensions to language codes
const extensionMap = {
  // JavaScript/TypeScript
  js: "js",
  jsx: "js",
  mjs: "js",
  cjs: "js",
  ts: "js", // TypeScript also uses JS highlighting
  tsx: "js",
  
  // Python
  py: "py",
  pyw: "py",
  
  // HTML
  html: "html",
  htm: "html",
  vue: "html", // Vue templates are HTML-based
  
  // C++
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  "c++": "cpp",
  h: "cpp",
  hpp: "cpp",
  c: "cpp",
};

/**
 * Detect language from filename based on extension
 * @param {string} filename - The filename with extension
 * @returns {string} Language code (js, py, html, cpp) or "js" as default
 */
export function detectLanguageFromFilename(filename) {
  if (!filename || typeof filename !== "string") return "js";
  
  // Extract extension (part after last dot)
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return "js"; // No extension, default to JS
  
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  return extensionMap[extension] || "js"; // Default to JS if extension not found
}
