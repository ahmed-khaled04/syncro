import { useEffect, useMemo, useRef, useState } from "react";
import { TextInputModal, ConfirmModal } from "./DialogComponents";
import { detectLanguageFromFilename } from "../utils/languageDetector";
import { useAllFileActivity } from "../hooks/useFileActivity";

/* ---------- tree helpers ---------- */
function buildTree(nodesMap) {
  const nodes = [];
  nodesMap.forEach((v, k) => {
    const node = {
      id: k,
      type: v.get("type"),
      name: v.get("name"),
      parentId: v.get("parentId"),
      fileId: v.get("fileId"),
      createdAt: v.get("createdAt"),
    };
    if (node.type === "file" && node.name) node.language = detectLanguageFromFilename(node.name);
    nodes.push(node);
  });

  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const root = byId.get("root");
  if (!root) return null;

  for (const n of byId.values()) {
    if (n.id === "root") continue;
    const p = byId.get(n.parentId || "root");
    if (p) p.children.push(n);
  }

  const sortRec = (node) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    node.children.forEach(sortRec);
  };
  sortRec(root);

  return root;
}

function Icon({ type, open }) {
  if (type === "folder") return <span className="text-sm">{open ? "📂" : "📁"}</span>;
  return <span className="text-sm">📄</span>;
}

function buildParentIndex(tree) {
  const parent = new Map();
  if (!tree) return parent;
  const walk = (node) => {
    for (const c of node.children || []) {
      parent.set(c.id, node.id);
      walk(c);
    }
  };
  parent.set("root", null);
  walk(tree);
  return parent;
}

function isAncestor(parentIndex, ancestorId, nodeId) {
  let cur = nodeId;
  while (cur) {
    const p = parentIndex.get(cur);
    if (!p) return false;
    if (p === ancestorId) return true;
    cur = p;
  }
  return false;
}

/* ---------- validation helpers ---------- */
const INVALID_CHARS_RE = /[\/\\:*?"<>|]/;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

function normalizeName(input) {
  return String(input ?? "").trim().replace(/\s+/g, " ");
}

function splitExt(filename) {
  const name = String(filename || "");
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) return { base: name, ext: "" };
  return { base: name.slice(0, lastDot), ext: name.slice(lastDot + 1) };
}

function isValidExt(ext) {
  return /^[a-z0-9]{1,12}$/i.test(ext);
}

function validateFolderName(raw) {
  const name = normalizeName(raw);
  if (!name) return { ok: false, msg: "Folder name cannot be empty." };
  if (name === "." || name === "..") return { ok: false, msg: "Invalid folder name." };
  if (name.length > 60) return { ok: false, msg: "Folder name is too long (max 60 chars)." };
  if (INVALID_CHARS_RE.test(name) || CONTROL_CHARS_RE.test(name))
    return { ok: false, msg: 'Invalid characters: / \\ : * ? " < > |' };
  return { ok: true, name };
}

function validateFileName(raw, { oldName } = {}) {
  let name = normalizeName(raw);
  if (!name) return { ok: false, msg: "File name cannot be empty." };
  if (name === "." || name === "..") return { ok: false, msg: "Invalid file name." };
  if (name.length > 80) return { ok: false, msg: "File name is too long (max 80 chars)." };
  if (INVALID_CHARS_RE.test(name) || CONTROL_CHARS_RE.test(name))
    return { ok: false, msg: 'Invalid characters: / \\ : * ? " < > |' };

  const { base, ext } = splitExt(name);
  const { ext: oldExt } = splitExt(oldName || "");

  // If no extension entered during rename, keep old extension (if any)
  if (!ext) {
    if (oldExt) {
      name = `${base}.${oldExt}`;
      return { ok: true, name };
    }
    return { ok: false, msg: 'File must have an extension (example: "main.js").' };
  }

  if (!base) return { ok: false, msg: "File name must include a name before the extension." };
  if (!isValidExt(ext)) return { ok: false, msg: "Invalid file extension." };

  return { ok: true, name };
}

function hasDuplicateInFolder(nodesMap, parentId, name, excludeNodeId = null) {
  const target = normalizeName(name).toLowerCase();
  const pid = parentId || "root";

  for (const [id, yNode] of nodesMap.entries()) {
    if (excludeNodeId && id === excludeNodeId) continue;
    const nParent = yNode.get("parentId") || "root";
    const nName = normalizeName(yNode.get("name")).toLowerCase();
    if (nParent === pid && nName === target) return true;
  }
  return false;
}

function extLabel(ext) {
  if (!ext) return "(none)";
  return "." + String(ext).toLowerCase();
}

/* ---------- component ---------- */
export default function FileExplorer({
  ydoc,
  socket,
  roomId,
  canEdit,
  selectedFileId,
  onSelectFile,
  awareness,
}) {
  const [expanded, setExpanded] = useState(() => new Set(["root"]));
  const [tree, setTree] = useState(null);

  const allFileActivity = useAllFileActivity(awareness);

  // Drag & drop
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOverNode, setDragOverNode] = useState(null);
  const [dropMode, setDropMode] = useState(null);
  const dragOverTimeoutRef = useRef(null);
  const overNodeRowRef = useRef(false);

  // Modals
  const [inputModal, setInputModal] = useState({
    open: false,
    title: "",
    placeholder: "",
    action: null, // create-file | create-folder | rename
    parentId: null,
    nodeId: null,
    defaultValue: "",
  });

  // ✅ One confirm modal used for multiple “kinds”
  const [confirmState, setConfirmState] = useState({
    open: false,
    kind: null, // "delete" | "ext-change"
    title: "",
    description: "",
    dangerous: false,
  });

  // ✅ pending operations for confirm modal
  const pendingRef = useRef(null);

  // ✅ live modal value + validation
  const [inputError, setInputError] = useState("");
  const [disableConfirm, setDisableConfirm] = useState(false);

  const nodesMap = useMemo(() => (ydoc ? ydoc.getMap("fs:nodes") : null), [ydoc]);

  useEffect(() => {
    if (!ydoc) return;
    const nodes = ydoc.getMap("fs:nodes");
    if (!nodes) return;

    const update = () => {
      const t = buildTree(nodes);
      setTree(t);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add("root");
        return next;
      });
    };

    update();
    const updateHandler = () => update();
    nodes.observeDeep(updateHandler);
    return () => nodes.unobserveDeep(updateHandler);
  }, [ydoc]);

  const parentIndex = useMemo(() => buildParentIndex(tree), [tree]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openInput = (nextModal) => {
    setInputError("");
    setDisableConfirm(true); // start disabled until valid
    setInputModal(nextModal);
    // validate initial value
    setTimeout(() => validateModalValue(nextModal, nextModal.defaultValue || ""), 0);
  };

  const createFile = (parentId) => {
    if (!canEdit) return;
    openInput({
      open: true,
      title: "New file",
      placeholder: "newFile.js",
      action: "create-file",
      parentId,
      nodeId: null,
      defaultValue: "",
    });
  };

  const createFolder = (parentId) => {
    if (!canEdit) return;
    openInput({
      open: true,
      title: "New folder",
      placeholder: "newFolder",
      action: "create-folder",
      parentId,
      nodeId: null,
      defaultValue: "",
    });
  };

  const rename = (nodeId, oldName) => {
    if (!canEdit) return;
    openInput({
      open: true,
      title: "Rename",
      placeholder: oldName,
      action: "rename",
      parentId: null,
      nodeId,
      defaultValue: oldName,
    });
  };

  const del = (nodeId, name) => {
    if (!canEdit) return;

    pendingRef.current = { kind: "delete", nodeId };
    setConfirmState({
      open: true,
      kind: "delete",
      title: "Delete file/folder?",
      description: `Are you sure you want to delete "${name}"? This will remove it for everyone in the room.`,
      dangerous: true,
    });
  };

  const clearDragUI = () => {
    if (dragOverTimeoutRef.current) clearTimeout(dragOverTimeoutRef.current);
    setDragOverNode(null);
    setDropMode(null);
    overNodeRowRef.current = false;
  };

  const isIllegalMove = (movingNode, targetFolderId) => {
    if (!movingNode) return true;
    if (movingNode.id === "root") return true;
    if (targetFolderId === movingNode.id) return true;
    if (movingNode.type === "folder") {
      if (isAncestor(parentIndex, movingNode.id, targetFolderId)) return true;
    }
    return false;
  };

  const handleDragStart = (e, node) => {
    if (!canEdit || node.id === "root") {
      e.preventDefault();
      return;
    }
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", node.id);
  };

  const handleDragOverNode = (e, targetNode) => {
    e.preventDefault();
    e.stopPropagation();
    overNodeRowRef.current = true;

    e.dataTransfer.dropEffect = "move";
    if (!canEdit || !draggedNode) return;
    if (draggedNode.id === targetNode.id) return;

    let mode = null;

    if (targetNode.type === "folder") {
      if (isIllegalMove(draggedNode, targetNode.id)) return;
      mode = "into";

      if (!expanded.has(targetNode.id)) {
        if (dragOverTimeoutRef.current) clearTimeout(dragOverTimeoutRef.current);
        dragOverTimeoutRef.current = setTimeout(() => {
          setExpanded((prev) => {
            const next = new Set(prev);
            next.add(targetNode.id);
            return next;
          });
        }, 500);
      }
    } else {
      const parentId = targetNode.parentId || "root";
      if (isIllegalMove(draggedNode, parentId)) return;
      mode = "same-parent";
    }

    setDragOverNode(targetNode);
    setDropMode(mode);
  };

  const handleDropOnNode = (e, targetNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || !canEdit) {
      setDraggedNode(null);
      clearDragUI();
      return;
    }
    if (draggedNode.id === targetNode.id) {
      setDraggedNode(null);
      clearDragUI();
      return;
    }

    if (targetNode.type === "folder") {
      if (isIllegalMove(draggedNode, targetNode.id)) {
        setDraggedNode(null);
        clearDragUI();
        return;
      }
      socket.emit("fs:move", { roomId, nodeId: draggedNode.id, parentId: targetNode.id });
    } else {
      const parentId = targetNode.parentId || "root";
      if (isIllegalMove(draggedNode, parentId)) {
        setDraggedNode(null);
        clearDragUI();
        return;
      }
      socket.emit("fs:move", { roomId, nodeId: draggedNode.id, parentId });
    }

    setDraggedNode(null);
    clearDragUI();
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
    clearDragUI();
  };

  const handleDragOverEmpty = (e) => {
    if (!canEdit || !draggedNode) return;
    if (overNodeRowRef.current) return;
    if (e.target !== e.currentTarget) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverNode({ id: "__empty__", type: "empty" });
    setDropMode("root");
  };

  const handleDropOnEmpty = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNode || !canEdit) {
      setDraggedNode(null);
      clearDragUI();
      return;
    }
    if (e.target !== e.currentTarget) return;

    socket.emit("fs:move", { roomId, nodeId: draggedNode.id, parentId: "root" });
    setDraggedNode(null);
    clearDragUI();
  };

  const handleDragLeaveContainer = () => {
    overNodeRowRef.current = false;
    setDragOverNode(null);
    setDropMode(null);
  };

  // ✅ LIVE VALIDATION
  const validateModalValue = (modal, raw) => {
    if (!nodesMap) {
      setInputError("Not ready yet.");
      setDisableConfirm(true);
      return { ok: false };
    }

    const { action, parentId, nodeId, defaultValue } = modal;

    if (action === "create-file") {
      const v = validateFileName(raw);
      if (!v.ok) {
        setInputError(v.msg);
        setDisableConfirm(true);
        return { ok: false };
      }
      if (hasDuplicateInFolder(nodesMap, parentId || "root", v.name)) {
        setInputError("A file/folder with the same name already exists in this folder.");
        setDisableConfirm(true);
        return { ok: false };
      }
      setInputError("");
      setDisableConfirm(false);
      return { ok: true, name: v.name };
    }

    if (action === "create-folder") {
      const v = validateFolderName(raw);
      if (!v.ok) {
        setInputError(v.msg);
        setDisableConfirm(true);
        return { ok: false };
      }
      if (hasDuplicateInFolder(nodesMap, parentId || "root", v.name)) {
        setInputError("A file/folder with the same name already exists in this folder.");
        setDisableConfirm(true);
        return { ok: false };
      }
      setInputError("");
      setDisableConfirm(false);
      return { ok: true, name: v.name };
    }

    if (action === "rename") {
      if (!nodeId || nodeId === "root") {
        setInputError("Invalid target.");
        setDisableConfirm(true);
        return { ok: false };
      }
      const node = nodesMap.get(nodeId);
      if (!node) {
        setInputError("Invalid target.");
        setDisableConfirm(true);
        return { ok: false };
      }

      const type = node.get("type");
      const currentParentId = node.get("parentId") || "root";
      const oldName = node.get("name") || defaultValue;

      const v = type === "file" ? validateFileName(raw, { oldName }) : validateFolderName(raw);
      if (!v.ok) {
        setInputError(v.msg);
        setDisableConfirm(true);
        return { ok: false };
      }

      if (normalizeName(v.name) === normalizeName(oldName)) {
        setInputError("");
        setDisableConfirm(false);
        return { ok: true, name: v.name, sameAsOld: true };
      }

      if (hasDuplicateInFolder(nodesMap, currentParentId, v.name, nodeId)) {
        setInputError("A file/folder with the same name already exists in this folder.");
        setDisableConfirm(true);
        return { ok: false };
      }

      setInputError("");
      setDisableConfirm(false);
      return { ok: true, name: v.name, oldName, nodeType: type };
    }

    setInputError("");
    setDisableConfirm(false);
    return { ok: true, name: normalizeName(raw) };
  };

  const handleInputConfirm = (rawValue) => {
    const res = validateModalValue(inputModal, rawValue);
    if (!res.ok) return;

    const { action, parentId, nodeId } = inputModal;

    if (action === "create-file") {
      socket.emit("fs:create-file", { roomId, parentId, name: res.name });
      setInputModal((m) => ({ ...m, open: false }));
      return;
    }

    if (action === "create-folder") {
      socket.emit("fs:create-folder", { roomId, parentId, name: res.name });
      setInputModal((m) => ({ ...m, open: false }));
      return;
    }

    if (action === "rename") {
      if (res.sameAsOld) {
        setInputModal((m) => ({ ...m, open: false }));
        return;
      }

      // ✅ NEW: extension-change confirmation for FILES only
      if (res.nodeType === "file") {
        const oldExt = splitExt(res.oldName || "").ext;
        const newExt = splitExt(res.name || "").ext;

        if (String(oldExt || "").toLowerCase() !== String(newExt || "").toLowerCase()) {
          // keep rename modal open; show confirm modal on top
          pendingRef.current = { kind: "ext-change", nodeId, name: res.name };

          setConfirmState({
            open: true,
            kind: "ext-change",
            title: "Change file extension?",
            description: `You are changing the extension from ${extLabel(oldExt)} to ${extLabel(
              newExt
            )}. This may change syntax highlighting and how collaborators treat this file. Continue?`,
            dangerous: false,
          });
          return;
        }
      }

      socket.emit("fs:rename", { roomId, nodeId, name: res.name });
      setInputModal((m) => ({ ...m, open: false }));
      return;
    }

    setInputModal((m) => ({ ...m, open: false }));
  };

  const handleConfirmYes = () => {
    const p = pendingRef.current;
    if (!p) {
      setConfirmState((c) => ({ ...c, open: false }));
      return;
    }

    if (p.kind === "delete") {
      if (p.nodeId && p.nodeId !== "root") {
        socket.emit("fs:delete", { roomId, nodeId: p.nodeId });
      }
      pendingRef.current = null;
      setConfirmState((c) => ({ ...c, open: false }));
      return;
    }

    if (p.kind === "ext-change") {
      socket.emit("fs:rename", { roomId, nodeId: p.nodeId, name: p.name });
      pendingRef.current = null;
      setConfirmState((c) => ({ ...c, open: false }));
      // Close rename modal after confirmed rename
      setInputModal((m) => ({ ...m, open: false }));
      return;
    }

    pendingRef.current = null;
    setConfirmState((c) => ({ ...c, open: false }));
  };

  const handleConfirmNo = () => {
    // Just close confirm; keep rename modal open so user can adjust name
    pendingRef.current = null;
    setConfirmState((c) => ({ ...c, open: false }));
  };

  const renderNode = (node, depth = 0) => {
    const isFolder = node.type === "folder";
    const isOpen = expanded.has(node.id);
    const isActiveFile = node.type === "file" && node.fileId === selectedFileId;

    const isDragged = draggedNode?.id === node.id;
    const isOverThis = dragOverNode?.id === node.id;

    let overClass = "";
    if (isOverThis && dropMode === "into") overClass = "ring-2 ring-indigo-500/60 bg-indigo-500/10";
    if (isOverThis && dropMode === "same-parent") overClass = "border border-indigo-500/30 bg-indigo-500/5";

    return (
      <div key={node.id}>
        <div
          draggable={canEdit && node.id !== "root"}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOverNode(e, node)}
          onDragLeave={() => {
            overNodeRowRef.current = false;
          }}
          onDrop={(e) => handleDropOnNode(e, node)}
          onDragEnd={handleDragEnd}
          className={[
            "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
            "hover:bg-zinc-800/40 transition-colors",
            isDragged ? "opacity-50 bg-zinc-800/30" : "",
            isActiveFile ? "bg-indigo-500/10 ring-1 ring-indigo-500/20" : "",
            overClass,
            canEdit && node.id !== "root" ? "cursor-move" : "",
          ].join(" ")}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <button
            type="button"
            onClick={() => (isFolder ? toggle(node.id) : onSelectFile(node.fileId))}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            <Icon type={node.type} open={isOpen} />
            <span className="truncate text-zinc-200">{node.name}</span>

            {node.type === "file" && node.fileId && allFileActivity.has(node.fileId) && (() => {
              const { viewing: v, editing: e } = allFileActivity.get(node.fileId);
              return v > 0 || e > 0 ? (
                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                  {e > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30 font-semibold whitespace-nowrap">
                      <span>✍️</span> {e}
                    </span>
                  )}
                  {v - e > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30 font-semibold whitespace-nowrap">
                      <span>👀</span> {v - e}
                    </span>
                  )}
                </div>
              ) : null;
            })()}
          </button>

          {canEdit && (
            <div className="hidden group-hover:flex items-center gap-1">
              {isFolder && (
                <>
                  <button
                    type="button"
                    onClick={() => createFile(node.id)}
                    className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/50"
                    title="New file"
                  >
                    +F
                  </button>
                  <button
                    type="button"
                    onClick={() => createFolder(node.id)}
                    className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/50"
                    title="New folder"
                  >
                    +D
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => rename(node.id, node.name)}
                className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800/50"
                title="Rename"
              >
                ✎
              </button>

              {node.id !== "root" && (
                <button
                  type="button"
                  onClick={() => del(node.id, node.name)}
                  className="rounded-md border border-zinc-700 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-100"
                  title="Delete"
                >
                  🗑
                </button>
              )}
            </div>
          )}
        </div>

        {isFolder && isOpen && (
          <div>
            {node.children.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500" style={{ paddingLeft: 18 + depth * 14 }}>
                Empty
              </div>
            ) : (
              node.children.map((c) => renderNode(c, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  const rootChildren = tree?.children || [];

  return (
    <>
      <TextInputModal
        open={inputModal.open}
        title={inputModal.title}
        label="Name:"
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
        onConfirm={handleInputConfirm}
        onCancel={() => setInputModal((m) => ({ ...m, open: false }))}
        confirmText={inputModal.action === "rename" ? "Rename" : "Create"}
        error={inputError}
        disableConfirm={disableConfirm}
        onValueChange={(val) => {
          validateModalValue(inputModal, val);
        }}
      />

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.kind === "delete" ? "Delete" : "Continue"}
        cancelText="Cancel"
        dangerous={!!confirmState.dangerous}
        onConfirm={handleConfirmYes}
        onCancel={handleConfirmNo}
      />

      <div className="h-full flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
          <div className="text-sm font-semibold text-zinc-200">Files</div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => createFile("root")}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40"
              >
                + File
              </button>
              <button
                type="button"
                onClick={() => createFolder("root")}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40"
              >
                + Folder
              </button>
            </div>
          )}
        </div>

        <div
          className={[
            "flex-1 overflow-auto p-2",
            draggedNode && dropMode === "root" ? "ring-2 ring-indigo-500/30 bg-indigo-500/5" : "",
          ].join(" ")}
          onDragOver={handleDragOverEmpty}
          onDrop={handleDropOnEmpty}
          onDragLeave={handleDragLeaveContainer}
        >
          {rootChildren.length === 0 ? (
            <div className="p-3 text-sm text-zinc-500">No files yet.</div>
          ) : (
            rootChildren.map((n) => renderNode(n, 0))
          )}
        </div>
      </div>
    </>
  );
}
