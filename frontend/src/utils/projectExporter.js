import JSZip from "jszip";

/**
 * Export the entire project as a ZIP file
 * @param {Y.Doc} ydoc - The Yjs document
 * @param {string} projectName - Name for the downloaded ZIP
 */
export async function exportProjectAsZip(ydoc, projectName = "project") {
  if (!ydoc) throw new Error("No Yjs document available");

  const zip = new JSZip();
  const nodes = ydoc.getMap("fs:nodes");
  const files = ydoc.getMap("files");

  if (!nodes) throw new Error("File structure not found");

  // Build a map of nodeId -> parent nodeId for path resolution
  const parentMap = new Map();
  for (const [nodeId, node] of nodes.entries()) {
    if (node) {
      const parentId = node.get("parentId");
      parentMap.set(nodeId, parentId);
    }
  }

  // Build file paths by walking up the parent chain
  for (const [nodeId, node] of nodes.entries()) {
    if (!node || node.get("type") !== "file") continue;

    const fileId = node.get("fileId");
    if (!fileId) continue;

    // Walk up the parent chain to build the full path
    const pathParts = [];
    let current = nodeId;
    while (current && current !== "root") {
      const currentNode = nodes.get(current);
      if (!currentNode) break;
      pathParts.unshift(currentNode.get("name"));
      current = parentMap.get(current);
    }

    const filePath = pathParts.join("/");
    const ytext = files.get(fileId);
    if (ytext) {
      const content = ytext.toString();
      zip.file(filePath, content);
    }
  }

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${projectName}-export.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
