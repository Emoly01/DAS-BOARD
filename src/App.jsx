import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyDNgGC-3qksHbOWsKcEh50_5ZE6wH3n8aQ",
  authDomain: "dnd-tools-1dd87.firebaseapp.com",
  projectId: "dnd-tools-1dd87",
  storageBucket: "dnd-tools-1dd87.firebasestorage.app",
  messagingSenderId: "866582352851",
  appId: "1:866582352851:web:269ec8b40fc5764425d526"
});
const db = getFirestore(app);
const storage = {
  async get(key) {
    const snap = await getDoc(doc(db, "kv", key));
    if (!snap.exists()) throw new Error("not found");
    return { value: snap.data().value };
  },
  async set(key, value) {
    await setDoc(doc(db, "kv", key), { value });
    return { key, value };
  }
};

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

const NODE_TYPES = [
  { id: "suspect",  label: "Verdächtig",  icon: "🕵️", color: "#fff0d4", border: "#c8843a", pinColor: "#e53935" },
  { id: "location", label: "Ort",         icon: "📍", color: "#d4eaff", border: "#3a6ec8", pinColor: "#1565c0" },
  { id: "event",    label: "Ereignis",    icon: "⚡", color: "#d4ffd4", border: "#3ac83a", pinColor: "#2e7d32" },
  { id: "faction",  label: "Fraktion",    icon: "⚔️", color: "#f0d4ff", border: "#9c3ac8", pinColor: "#6a0dad" },
  { id: "question", label: "Frage",       icon: "❓", color: "#ffd4d4", border: "#c83a3a", pinColor: "#b71c1c" },
  { id: "meme",     label: "Meme",        icon: "💀", color: "#ffe4c4", border: "#c87a3a", pinColor: "#e65100" },
];

function stringPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(len * 0.12, 40);
  const cx = mx - dy * sag / len;
  const cy = my + dx * sag / len;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

// Mid-point of a quadratic bezier (for label placement)
function bezierMid(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(len * 0.12, 40);
  const cx = mx - dy * sag / len;
  const cy = my + dx * sag / len;
  // Point at t=0.5 on quadratic bezier
  return {
    x: 0.25 * x1 + 0.5 * cx + 0.25 * x2,
    y: 0.25 * y1 + 0.5 * cy + 0.25 * y2,
  };
}

function NodeCard({ node, selected, connecting, onMouseDown, onClick, onDoubleClick, onEdit, onDelete, isConnecting }) {
  const nt = NODE_TYPES.find(t => t.id === node.type) || NODE_TYPES[0];
  return (
    <div
      className={`node-card ${selected ? "selected" : ""} ${connecting ? "connecting-source" : ""} ${isConnecting ? "connectable" : ""}`}
      style={{
        position: "absolute",
        left: node.x, top: node.y,
        "--nc": nt.color, "--nb": nt.border,
        transform: `rotate(${node.rot || 0}deg)`,
        zIndex: selected ? 20 : 10,
        width: node.type === "meme" ? 240 : 200,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="node-pin" style={{ background: nt.pinColor }} />
      <div className="node-type-row">
        <span className="node-type-icon">{nt.icon}</span>
        <span className="node-type-label">{nt.label}</span>
        <div className="node-btns">
          <button className="node-btn" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(); }}>✎</button>
          <button className="node-btn del" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(); }}>✕</button>
        </div>
      </div>
      {node.imageUrl && (
        <img src={node.imageUrl} alt={node.title}
          style={{ width: "100%", borderRadius: "2px", marginBottom: "0.4rem", display: "block", maxHeight: 180, objectFit: "cover" }}
          onError={e => e.target.style.display = "none"} />
      )}
      <p className="node-title">{node.title || "???"}</p>
      {node.notes && <p className="node-notes">{node.notes}</p>}
    </div>
  );
}

function EditModal({ node, onSave, onCancel }) {
  const nt = NODE_TYPES.find(t => t.id === node.type) || NODE_TYPES[0];
  const [form, setForm] = useState({ ...node });
  const isImage = form.type === "meme";
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="edit-modal" onClick={e => e.stopPropagation()}>
        <p className="modal-title">📌 {nt.icon} Bearbeiten</p>
        <div className="modal-type-row">
          {NODE_TYPES.map(t => (
            <span key={t.id} className={`mtype-opt ${form.type === t.id ? "sel" : ""}`}
              style={{ "--mc": t.border }} onClick={() => setForm(f => ({ ...f, type: t.id }))}>
              {t.icon}
            </span>
          ))}
        </div>
        <input className="modal-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Titel / Name..." autoFocus />
        {!isImage && (
          <textarea className="modal-input" rows={3} value={form.notes || ""}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notizen, Verdacht, Details..." />
        )}
        <input className="modal-input" value={form.imageUrl || ""}
          onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
          placeholder="Bild-URL (optional — Imgur etc.)" />
        <div className="modal-actions">
          <button className="modal-save-btn" onClick={() => onSave(form)} disabled={!form.title.trim()}>Speichern</button>
          <button className="modal-cancel-btn" onClick={onCancel}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ── NEW: Inline label editor that floats near the string midpoint ──
function ConnLabelEditor({ conn, midX, midY, boardOffset, boardScale, onSave, onCancel }) {
  const [val, setVal] = useState(conn.label || "");
  const inputRef = useRef(null);

  // Convert board coords → screen coords
  const screenX = midX * boardScale + boardOffset.x;
  const screenY = midY * boardScale + boardOffset.y + 50; // +50 for toolbar height

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  return (
    <div style={{
      position: "fixed",
      left: screenX, top: screenY,
      transform: "translate(-50%, -50%)",
      zIndex: 300,
      background: "#fffde7",
      border: "2px solid #c8843a",
      borderRadius: "3px",
      padding: "0.4rem 0.5rem",
      boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
      display: "flex", gap: "0.3rem", alignItems: "center",
    }}>
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") onSave(val);
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Label..."
        style={{
          fontFamily: "'Architects Daughter', cursive",
          fontSize: "0.82rem",
          border: "none", borderBottom: "2px dashed #c8a050",
          background: "transparent", color: "#2a1800",
          outline: "none", width: "120px", padding: "0.2rem",
        }}
      />
      <button onClick={() => onSave(val)} style={{ fontFamily: "'Permanent Marker', cursive", fontSize: "0.72rem", background: "#e53935", color: "#fff", border: "none", padding: "0.2rem 0.5rem", cursor: "pointer", borderRadius: "2px" }}>✓</button>
      <button onClick={onCancel} style={{ fontFamily: "'Architects Daughter', cursive", fontSize: "0.72rem", background: "transparent", color: "#5a3a0a", border: "1px solid #c8a050", padding: "0.2rem 0.4rem", cursor: "pointer", borderRadius: "2px" }}>✕</button>
    </div>
  );
}

export default function ConspiracyBoard() {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState("drag");
  const [connectSource, setConnectSource] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [editingConn, setEditingConn] = useState(null); // { conn, midX, midY }
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [boardScale, setBoardScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredConn, setHoveredConn] = useState(null);

  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => {
    const unsubNodes = onSnapshot(doc(db, "kv", "cb-nodes"), (snap) => {
      if (snap.exists()) {
        try { setNodes(JSON.parse(snap.data().value)); } catch { setNodes([]); }
      } else { setNodes([]); }
    });
    const unsubConns = onSnapshot(doc(db, "kv", "cb-conns"), (snap) => {
      if (snap.exists()) {
        try { setConnections(JSON.parse(snap.data().value)); } catch { setConnections([]); }
      } else { setConnections([]); }
    });
    setLoaded(true);
    return () => { unsubNodes(); unsubConns(); };
  }, []);

  const saveNodes = (u) => { setNodes(u); storage.set("cb-nodes", JSON.stringify(u)).catch(() => {}); };
  const saveConns = (u) => { setConnections(u); storage.set("cb-conns", JSON.stringify(u)).catch(() => {}); };

  const addNode = (type) => {
    const rect = boardRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
    const x = (-boardOffset.x + rect.width / 2) / boardScale - 70;
    const y = (-boardOffset.y + rect.height / 2) / boardScale - 50;
    const rot = (Math.random() - 0.5) * 6;
    const newNode = { id: makeId(), type, title: "", notes: "", imageUrl: "", x, y, rot };
    saveNodes([...nodes, newNode]);
    setEditingNode(newNode);
    setShowAddMenu(false);
  };

  const updateNode = (updated) => {
    saveNodes(nodes.map(n => n.id === updated.id ? { ...n, ...updated } : n));
    setEditingNode(null);
  };

  const deleteNode = useCallback((id) => {
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id);
      storage.set("cb-nodes", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    setConnections(prev => {
      const updated = prev.filter(c => c.a !== id && c.b !== id);
      storage.set("cb-conns", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    if (connectSource === id) setConnectSource(null);
    setSelectedNode(null);
  }, [connectSource]);

  // ── NEW: Delete key handler ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!selectedNode) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't fire if an input is focused
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        deleteNode(selectedNode);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNode, deleteNode]);

  const startDrag = useCallback((nodeId, e) => {
    if (mode !== "drag") return;
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragRef.current = { nodeId, startX: clientX, startY: clientY, origX: node.x, origY: node.y };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = (cx - dragRef.current.startX) / boardScale;
      const dy = (cy - dragRef.current.startY) / boardScale;
      setNodes(prev => prev.map(n => n.id === dragRef.current.nodeId
        ? { ...n, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy } : n));
    };
    const onUp = () => {
      if (dragRef.current) {
        setNodes(prev => {
          storage.set("cb-nodes", JSON.stringify(prev)).catch(() => {});
          return prev;
        });
        dragRef.current = null;
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }, [mode, nodes, boardScale]);

  const startPan = useCallback((e) => {
    if (mode !== "drag" || dragRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    panRef.current = { startX: clientX, startY: clientY, origX: boardOffset.x, origY: boardOffset.y };
    setIsPanning(true);

    const onMove = (ev) => {
      if (!panRef.current) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      setBoardOffset({ x: panRef.current.origX + cx - panRef.current.startX, y: panRef.current.origY + cy - panRef.current.startY });
    };
    const onUp = () => {
      panRef.current = null; setIsPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }, [mode, boardOffset]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setBoardScale(s => Math.min(2, Math.max(0.3, s * factor)));
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── FIXED: Reset centers the viewport on all existing nodes ──
  const handleReset = useCallback(() => {
    if (nodes.length === 0) {
      setBoardOffset({ x: 0, y: 0 });
      setBoardScale(1);
      return;
    }
    const rect = boardRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs) + 220; // node width approx
    const maxY = Math.max(...ys) + 140; // node height approx
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(
      1,
      (rect.width - 80) / contentW,
      (rect.height - 80) / contentH
    );
    const offsetX = rect.width / 2 - (minX + contentW / 2) * scale;
    const offsetY = rect.height / 2 - (minY + contentH / 2) * scale;
    setBoardScale(scale);
    setBoardOffset({ x: offsetX, y: offsetY });
  }, [nodes]);

  const handleNodeClick = (nodeId, e) => {
    e.stopPropagation();
    if (mode === "connect") {
      if (!connectSource) {
        setConnectSource(nodeId);
      } else if (connectSource !== nodeId) {
        const exists = connections.find(c => (c.a === connectSource && c.b === nodeId) || (c.a === nodeId && c.b === connectSource));
        if (!exists) {
          saveConns([...connections, { id: makeId(), a: connectSource, b: nodeId, label: "" }]);
        }
        setConnectSource(null);
        setMode("drag");
      }
    } else {
      setSelectedNode(selectedNode === nodeId ? null : nodeId);
    }
  };

  const deleteConnection = (connId) => {
    saveConns(connections.filter(c => c.id !== connId));
    setEditingConn(null);
  };

  // ── NEW: Save connection label ──
  const saveConnLabel = (connId, label) => {
    saveConns(connections.map(c => c.id === connId ? { ...c, label } : c));
    setEditingConn(null);
  };

  const nodeCenter = (node) => ({
    x: node.x + (node.type === "meme" ? 80 : 70),
    y: node.y + 50,
  });

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#5a3a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5c842", fontFamily: "'Permanent Marker', cursive", fontSize: "1.2rem" }}>
      🔍 lädt...
    </div>
  );

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#1a0a00", fontFamily: "'Architects Daughter', cursive", userSelect: "none" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Permanent+Marker&display=swap');
        * { box-sizing: border-box; }

        .toolbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: #1a0a00; border-bottom: 3px solid #5a3a0a;
          padding: 0.5rem 0.8rem;
          display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
          box-shadow: 0 3px 12px rgba(0,0,0,0.6);
        }
        .toolbar-title {
          font-family: 'Permanent Marker', cursive;
          font-size: clamp(0.9rem, 3vw, 1.3rem);
          color: #f5c842;
          text-shadow: 1px 1px 0 #3a2000;
          margin: 0; flex-shrink: 0;
        }
        .tool-sep { width: 1px; height: 24px; background: #3a2000; flex-shrink: 0; }
        .tool-btn {
          font-family: 'Architects Daughter', cursive;
          font-size: 0.82rem; padding: 0.35rem 0.7rem;
          border: 2px solid #5a3a0a; background: #2a1400;
          color: #c8a050; cursor: pointer; border-radius: 3px;
          transition: all 0.12s; white-space: nowrap;
          box-shadow: 2px 2px 0 #0a0500;
        }
        .tool-btn:hover { background: #3a1a00; color: #f5c842; border-color: #f5c842; }
        .tool-btn.active { background: #c0392b; color: #fff; border-color: #e74c3c; box-shadow: 2px 2px 0 #7b241c; }
        .tool-btn.connect-active { background: #e53935; color: #fff; border-color: #ff6b6b; animation: pulse 1s infinite; }
        .tool-btn.add { background: #1a5a1a; color: #90ee90; border-color: #2a8a2a; }
        .tool-btn.add:hover { background: #2a7a2a; color: #fff; }
        @keyframes pulse { 0%,100% { box-shadow: 2px 2px 0 #7b241c; } 50% { box-shadow: 2px 2px 8px #ff6b6b; } }

        .add-menu {
          position: fixed; top: 52px; left: 50%; transform: translateX(-50%);
          background: #1a0a00; border: 2px solid #5a3a0a;
          border-radius: 4px; padding: 0.6rem;
          display: flex; gap: 0.4rem; flex-wrap: wrap; z-index: 101;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
          max-width: 90vw;
        }
        .add-type-btn {
          font-family: 'Architects Daughter', cursive;
          font-size: 0.82rem; padding: 0.4rem 0.6rem;
          border: 2px solid var(--mc); background: rgba(255,255,255,0.05);
          color: var(--mc); cursor: pointer; border-radius: 3px;
          transition: all 0.12s; display: flex; align-items: center; gap: 0.3rem;
        }
        .add-type-btn:hover { background: var(--mc); color: #1a0a00; }

        .cork-board {
          position: absolute; inset: 0; top: 50px;
          cursor: grab;
          background-color: #8B6914;
          background-image:
            radial-gradient(ellipse at 15% 25%, rgba(120,85,10,0.6) 0%, transparent 40%),
            radial-gradient(ellipse at 85% 75%, rgba(90,60,5,0.5) 0%, transparent 40%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='1.5' cy='1.5' r='1' fill='rgba(0,0,0,0.06)'/%3E%3Ccircle cx='4.5' cy='4.5' r='0.7' fill='rgba(255,255,255,0.04)'/%3E%3Ccircle cx='1.5' cy='4.5' r='0.5' fill='rgba(0,0,0,0.04)'/%3E%3C/svg%3E");
        }
        .cork-board.panning { cursor: grabbing; }
        .cork-board.connecting { cursor: crosshair; }

        .node-card {
          position: absolute;
          background: var(--nc);
          border: 2px solid var(--nb);
          border-radius: 2px;
          padding: 0.7rem 0.7rem 0.6rem;
          cursor: grab;
          box-shadow: 3px 4px 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.2);
          transition: box-shadow 0.15s;
          min-width: 180px;
        }
        .node-card:hover { box-shadow: 5px 6px 0 rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2); }
        .node-card.selected { box-shadow: 0 0 0 3px #f5c842, 5px 6px 0 rgba(0,0,0,0.4); }
        .node-card.connectable { box-shadow: 0 0 0 3px #ff4444, 5px 6px 0 rgba(0,0,0,0.4); cursor: crosshair; }
        .node-card.connecting-source { box-shadow: 0 0 0 3px #f5c842, 0 0 12px #f5c842; }
        .node-pin {
          width: 14px; height: 14px; border-radius: 50%;
          position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3);
          border: 1px solid rgba(0,0,0,0.3);
          z-index: 5;
        }
        .node-type-row {
          display: flex; align-items: center; gap: 0.3rem;
          margin-bottom: 0.3rem; margin-top: 0.2rem;
        }
        .node-type-icon { font-size: 0.95rem; line-height: 1; flex-shrink: 0; }
        .node-type-label {
          font-family: 'Architects Daughter', cursive;
          font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(0,0,0,0.45); flex: 1;
        }
        .node-btns { display: flex; gap: 0.15rem; opacity: 0; transition: opacity 0.15s; }
        .node-card:hover .node-btns { opacity: 1; }
        .node-btn {
          font-size: 0.72rem; background: rgba(0,0,0,0.1); border: none;
          color: rgba(0,0,0,0.5); cursor: pointer; padding: 0.1rem 0.25rem;
          border-radius: 2px; transition: all 0.12s; line-height: 1;
        }
        .node-btn:hover { background: rgba(0,0,0,0.2); color: rgba(0,0,0,0.8); }
        .node-btn.del:hover { background: rgba(200,0,0,0.2); color: #900; }
        .node-title {
          font-family: 'Permanent Marker', cursive;
          font-size: 0.95rem; color: #1a0a00; margin: 0 0 0.2rem;
          line-height: 1.3; word-break: break-word;
        }
        .node-notes {
          font-family: 'Architects Daughter', cursive;
          font-size: 0.78rem; color: #3a2000; margin: 0;
          line-height: 1.4; word-break: break-word;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
        }

        .string-svg {
          position: absolute; inset: 0; pointer-events: none; overflow: visible;
        }
        .string-path {
          fill: none; stroke: #c0392b; stroke-width: 1.8;
          stroke-linecap: round;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
          pointer-events: stroke;
          cursor: pointer;
        }
        .string-path.hovered { stroke: #ff6b6b; stroke-width: 2.5; }
        .string-hit {
          fill: none; stroke: transparent; stroke-width: 16;
          cursor: pointer; pointer-events: stroke;
        }

        /* ── NEW: connection label tag ── */
        .conn-label-group { pointer-events: all; cursor: pointer; }
        .conn-label-bg {
          fill: #fffde7;
          stroke: #c8843a;
          stroke-width: 1;
          rx: 3;
        }
        .conn-label-text {
          font-family: 'Architects Daughter', cursive;
          font-size: 11px;
          fill: #3a2000;
          text-anchor: middle;
          dominant-baseline: central;
          pointer-events: none;
        }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7);
          z-index: 200; display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(2px);
        }
        .edit-modal {
          background: #fffde7; border-radius: 2px;
          padding: 1.2rem; width: min(340px, 92vw);
          box-shadow: 6px 6px 0 rgba(0,0,0,0.5);
          transform: rotate(-1deg);
          position: relative;
        }
        .edit-modal::before { content: "📌"; position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 1.4rem; }
        .modal-title {
          font-family: 'Permanent Marker', cursive;
          font-size: 1rem; color: #3a2000; margin: 0.4rem 0 0.6rem; text-align: center;
        }
        .modal-type-row { display: flex; gap: 0.4rem; justify-content: center; margin-bottom: 0.8rem; flex-wrap: wrap; }
        .mtype-opt {
          font-size: 1.2rem; padding: 0.3rem 0.4rem;
          border: 2px solid transparent; border-radius: 4px;
          cursor: pointer; transition: all 0.12s; line-height: 1;
        }
        .mtype-opt:hover { border-color: var(--mc); background: rgba(0,0,0,0.05); }
        .mtype-opt.sel { border-color: var(--mc); background: rgba(0,0,0,0.08); transform: scale(1.15); }
        .modal-input {
          width: 100%; background: transparent; border: none;
          border-bottom: 2px dashed #c8a050; color: #2a1800;
          font-family: 'Architects Daughter', cursive; font-size: 0.9rem;
          padding: 0.4rem 0.2rem; outline: none; resize: vertical;
          margin-bottom: 0.5rem; display: block; line-height: 1.5;
        }
        .modal-input::placeholder { color: #c8a870; }
        .modal-actions { display: flex; gap: 0.5rem; margin-top: 0.7rem; }
        .modal-save-btn {
          font-family: 'Permanent Marker', cursive; font-size: 0.85rem;
          background: #e53935; color: #fff; border: none;
          padding: 0.45rem 1.2rem; cursor: pointer; border-radius: 3px;
          box-shadow: 3px 3px 0 #8B0000; transition: all 0.1s; flex: 1;
        }
        .modal-save-btn:disabled { opacity: 0.3; }
        .modal-save-btn:active { transform: translate(1px,1px); box-shadow: 2px 2px 0 #8B0000; }
        .modal-cancel-btn {
          font-family: 'Architects Daughter', cursive; font-size: 0.7rem;
          background: rgba(0,0,0,0.08); border: 1px solid #c8a050;
          color: #5a3a0a; padding: 0.45rem 0.8rem; cursor: pointer; border-radius: 3px;
        }

        .hint-bar {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: rgba(0,0,0,0.7); padding: 0.3rem 0.8rem;
          display: flex; gap: 1rem; flex-wrap: wrap; z-index: 50;
        }
        .hint {
          font-family: 'Architects Daughter', cursive;
          font-size: 0.72rem; color: #8a6a3a;
          display: flex; align-items: center; gap: 0.3rem;
        }
        .hint span { color: #c8a050; }
        .count-badge {
          font-family: 'Architects Daughter', cursive;
          font-size: 0.72rem; color: #5a3a0a; margin-left: auto; flex-shrink: 0;
        }
      `}</style>

      {/* Toolbar */}
      <div className="toolbar">
        <p className="toolbar-title">🔍 Drachenkönig — Beweisbrett</p>
        <div className="tool-sep" />
        <button className={`tool-btn ${mode === "drag" ? "active" : ""}`} onClick={() => { setMode("drag"); setConnectSource(null); }}>
          ✋ Bewegen
        </button>
        <button className={`tool-btn ${mode === "connect" ? "connect-active" : ""}`}
          onClick={() => { setMode(mode === "connect" ? "drag" : "connect"); setConnectSource(null); }}>
          🔴 {mode === "connect" ? (connectSource ? "Ziel wählen..." : "Quelle wählen...") : "Verbinden"}
        </button>
        <button className={`tool-btn ${mode === "delete-conn" ? "active" : ""}`}
          onClick={() => { setMode(mode === "delete-conn" ? "drag" : "delete-conn"); setConnectSource(null); }}>
          ✂️ String löschen
        </button>
        <div className="tool-sep" />
        <button className="tool-btn add" onClick={() => setShowAddMenu(v => !v)}>
          📌 + Hinzufügen
        </button>
        <button className="tool-btn" onClick={handleReset}>
          🎯 Reset
        </button>
        <span className="count-badge">{nodes.length} Knoten · {connections.length} Verbindungen</span>
      </div>

      {/* Add type menu */}
      {showAddMenu && (
        <div className="add-menu">
          {NODE_TYPES.map(t => (
            <button key={t.id} className="add-type-btn" style={{ "--mc": t.border }}
              onClick={() => addNode(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Cork board canvas */}
      <div
        ref={boardRef}
        className={`cork-board ${isPanning ? "panning" : ""} ${mode === "connect" ? "connecting" : ""}`}
        onMouseDown={startPan}
        onTouchStart={startPan}
        onClick={() => { setShowAddMenu(false); if (mode !== "connect") setSelectedNode(null); }}
      >
        <div style={{
          position: "absolute",
          transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${boardScale})`,
          transformOrigin: "0 0",
          width: "3000px", height: "2000px",
        }}>
          {/* SVG strings + labels */}
          <svg className="string-svg" width="3000" height="2000">
            {connections.map(conn => {
              const a = nodes.find(n => n.id === conn.a);
              const b = nodes.find(n => n.id === conn.b);
              if (!a || !b) return null;
              const ca = nodeCenter(a), cb = nodeCenter(b);
              const path = stringPath(ca.x, ca.y, cb.x, cb.y);
              const mid = bezierMid(ca.x, ca.y, cb.x, cb.y);
              const isHovered = hoveredConn === conn.id;
              const hasLabel = conn.label && conn.label.trim();
              const labelW = hasLabel ? Math.max(60, conn.label.trim().length * 7 + 16) : 0;

              return (
                <g key={conn.id}>
                  <path d={path} className="string-hit"
                    onMouseEnter={() => setHoveredConn(conn.id)}
                    onMouseLeave={() => setHoveredConn(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode === "delete-conn") {
                        deleteConnection(conn.id);
                      } else {
                        // Click string to edit its label
                        setEditingConn({ conn, midX: mid.x, midY: mid.y });
                      }
                    }} />
                  <path d={path} className={`string-path ${isHovered ? "hovered" : ""}`}
                    onMouseEnter={() => setHoveredConn(conn.id)}
                    onMouseLeave={() => setHoveredConn(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode === "delete-conn") {
                        deleteConnection(conn.id);
                      } else {
                        setEditingConn({ conn, midX: mid.x, midY: mid.y });
                      }
                    }} />

                  {/* ── NEW: connection label ── */}
                  {hasLabel && (
                    <g className="conn-label-group"
                      onClick={(e) => { e.stopPropagation(); setEditingConn({ conn, midX: mid.x, midY: mid.y }); }}>
                      <rect
                        x={mid.x - labelW / 2}
                        y={mid.y - 10}
                        width={labelW}
                        height={20}
                        rx="3"
                        className="conn-label-bg"
                      />
                      <text
                        x={mid.x}
                        y={mid.y}
                        className="conn-label-text"
                      >
                        {conn.label.trim()}
                      </text>
                    </g>
                  )}

                  {/* ── NEW: "+" hint on hover (no label yet) ── */}
                  {!hasLabel && isHovered && mode !== "delete-conn" && (
                    <text x={mid.x} y={mid.y}
                      textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: "12px", fill: "#f5c842", fontFamily: "'Architects Daughter', cursive", pointerEvents: "none" }}>
                      + label
                    </text>
                  )}

                  {/* Delete X in delete mode */}
                  {isHovered && mode === "delete-conn" && (
                    <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: "14px", fill: "#ff4444", cursor: "pointer", fontFamily: "sans-serif", pointerEvents: "none" }}>
                      ✕
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(node => (
            <NodeCard
              key={node.id}
              node={node}
              selected={selectedNode === node.id}
              connecting={connectSource === node.id}
              isConnecting={mode === "connect" && connectSource && connectSource !== node.id}
              onMouseDown={(e) => startDrag(node.id, e)}
              onClick={(e) => handleNodeClick(node.id, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (mode === "drag") setEditingNode({ ...node });
              }}
              onEdit={() => setEditingNode({ ...node })}
              onDelete={() => deleteNode(node.id)}
            />
          ))}
        </div>
      </div>

      {/* Edit node modal */}
      {editingNode && (
        <EditModal
          node={editingNode}
          onSave={updateNode}
          onCancel={() => setEditingNode(null)}
        />
      )}

      {/* ── NEW: Connection label editor ── */}
      {editingConn && (
        <ConnLabelEditor
          conn={editingConn.conn}
          midX={editingConn.midX}
          midY={editingConn.midY}
          boardOffset={boardOffset}
          boardScale={boardScale}
          onSave={(label) => saveConnLabel(editingConn.conn.id, label)}
          onCancel={() => setEditingConn(null)}
        />
      )}

      {/* Hint bar */}
      <div className="hint-bar">
        <div className="hint">✋ <span>Ziehen</span> = Knoten bewegen</div>
        <div className="hint">🖱 <span>Doppelklick</span> = Knoten bearbeiten</div>
        <div className="hint">🔴 <span>Verbinden</span> = zwei Knoten anklicken</div>
        <div className="hint">🖱 <span>String anklicken</span> = Label hinzufügen</div>
        <div className="hint">⌨ <span>Entf</span> = ausgewählten Knoten löschen</div>
        <div className="hint">🖱 <span>Scrollen</span> = Zoom · <span>Leere Fläche ziehen</span> = Board bewegen</div>
      </div>
    </div>
  );
}
