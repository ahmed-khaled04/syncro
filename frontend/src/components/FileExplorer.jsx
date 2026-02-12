import { useEffect, useState } from "react";
import { TextInputModal, ConfirmModal } from "./DialogComponents";

function buildTree(nodesMap) {
  const nodes = [];
  nodesMap.forEach((v, k) => {
    nodes.push({
      id: k,
      type: v.get("type"),
      name: v.get("name"),
      parentId: v.get("parentId"),
      fileId: v.get("fileId"),
      createdAt: v.get("createdAt"),
    });
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

export default function FileExplorer({
  ydoc,
  socket,
  roomId,
  canEdit,
  selectedFileId,
  onSelectFile,
}) {
  const [expanded, setExpanded] = useState(() => new Set(["root"]));
  const [tree, setTree] = useState(null);

  // Modal states
  const [inputModal, setInputModal] = useState({
    open: false,
    title: "",
    placeholder: "",
    action: null, // 'create-file' | 'create-folder' | 'rename'
    parentId: null,
    nodeId: null,
    defaultValue: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    name: "",
    nodeId: null,
  });

  useEffect(() => {
    if (!ydoc) return;

    const update = () => {
      // Get fresh reference to nodes map each time
      const nodes = ydoc.getMap("fs:nodes");
      if (!nodes) return;
      
      const t = buildTree(nodes);
      setTree(t);
      // auto expand root
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add("root");
        return next;
      });
    };

    // Call once on mount
    update();
    
    // Listen to ALL updates on the Y.Doc, not just deep changes
    // This ensures we catch file creations immediately
    const updateHandler = () => {
      update();
    };
    
    ydoc.on("update", updateHandler);
    
    return () => {
      ydoc.off("update", updateHandler);
    };
  }, [ydoc]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createFile = (parentId) => {
    if (!canEdit) return;
    setInputModal({
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
    setInputModal({
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
    setInputModal({
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
    setConfirmModal({
      open: true,
      name,
      nodeId,
    });
  };

  const handleInputConfirm = (value) => {
    if (!value.trim()) {
      setInputModal({ ...inputModal, open: false });
      return;
    }

    const { action, parentId, nodeId } = inputModal;

    if (action === "create-file") {
      socket.emit("fs:create-file", { roomId, parentId, name: value });
    } else if (action === "create-folder") {
      socket.emit("fs:create-folder", { roomId, parentId, name: value });
    } else if (action === "rename") {
      if (value !== inputModal.defaultValue) {
        socket.emit("fs:rename", { roomId, nodeId, name: value });
      }
    }

    setInputModal({ ...inputModal, open: false });
  };

  const handleConfirmDelete = () => {
    if (confirmModal.nodeId && confirmModal.nodeId !== "root") {
      socket.emit("fs:delete", { roomId, nodeId: confirmModal.nodeId });
    }
    setConfirmModal({ ...confirmModal, open: false });
  };

  const renderNode = (node, depth = 0) => {
    const isFolder = node.type === "folder";
    const isOpen = expanded.has(node.id);

    const isActiveFile = node.type === "file" && node.fileId === selectedFileId;

    return (
      <div key={node.id}>
        <div
          className={[
            "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
            "hover:bg-zinc-800/40",
            isActiveFile ? "bg-indigo-500/10 ring-1 ring-indigo-500/20" : "",
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
              <div
                className="px-3 py-2 text-xs text-zinc-500"
                style={{ paddingLeft: 18 + depth * 14 }}
              >
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
      {/* Input Modal */}
      <TextInputModal
        open={inputModal.open}
        title={inputModal.title}
        label="Name:"
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
        onConfirm={handleInputConfirm}
        onCancel={() => setInputModal({ ...inputModal, open: false })}
        confirmText="Create"
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title="Delete file?"
        description={`Are you sure you want to delete "${confirmModal.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        dangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal({ ...confirmModal, open: false })}
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

      <div className="flex-1 overflow-auto p-2">
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
