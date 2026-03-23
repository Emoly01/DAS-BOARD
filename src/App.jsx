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
  { id: "suspect",  label: "Suspect",  icon: "◈", color: "#16120a", border: "#c8a050", pinColor: "#c8a050", textColor: "#f0e6c8" },
  { id: "location", label: "Location", icon: "◉", color: "#0a0f18", border: "#4a7fa8", pinColor: "#6aafd8", textColor: "#c8dff0" },
  { id: "event",    label: "Event",    icon: "◆", color: "#160a0a", border: "#8b2020", pinColor: "#c0392b", textColor: "#f0c8c8" },
  { id: "faction",  label: "Faction",  icon: "◇", color: "#100a18", border: "#7a4ab0", pinColor: "#9b59b6", textColor: "#dcc8f0" },
  { id: "question", label: "Unknown",  icon: "?", color: "#111111", border: "#555555", pinColor: "#888888", textColor: "#cccccc" },
  { id: "meme",     label: "Evidence", icon: "◎", color: "#0a160a", border: "#2e7d32", pinColor: "#43a047", textColor: "#c8f0c8" },
];

function stringPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(len * 0.13, 45);
  const cx = mx - dy * sag / len;
  const cy = my + dx * sag / len;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function bezierMid(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.min(len * 0.13, 45);
  const cx = mx - dy * sag / len;
  const cy = my + dx * sag / len;
  return { x: 0.25 * x1 + 0.5 * cx + 0.25 * x2, y: 0.25 * y1 + 0.5 * cy + 0.25 * y2 };
}

function NodeCard({ node, selected, connecting, onMouseDown, onClick, onDoubleClick, onEdit, onDelete, isConnecting }) {
  const nt = NODE_TYPES.find(t => t.id === node.type) || NODE_TYPES[0];
  return (
    <div
      className={`node-card ${selected ? "selected" : ""} ${connecting ? "connecting-source" : ""} ${isConnecting ? "connectable" : ""}`}
      style={{
        position: "absolute", left: node.x, top: node.y,
        "--nc": nt.color, "--nb": nt.border, "--nt": nt.textColor,
        transform: `rotate(${node.rot || 0}deg)`,
        zIndex: selected ? 20 : 10,
        width: node.type === "meme" ? 240 : 210,
      }}
      onMouseDown={onMouseDown} onTouchStart={onMouseDown}
      onClick={onClick} onDoubleClick={onDoubleClick}
    >
      <div className="node-pin" style={{ background: nt.pinColor, boxShadow: `0 0 8px ${nt.pinColor}99` }} />
      <div className="node-type-row">
        <span className="node-type-icon" style={{ color: nt.border }}>{nt.icon}</span>
        <span className="node-type-label">{nt.label}</span>
        <div className="node-btns">
          <button className="node-btn" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(); }}>✎</button>
          <button className="node-btn del" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(); }}>✕</button>
        </div>
      </div>
      {node.imageUrl && (
        <img src={node.imageUrl} alt={node.title}
          style={{ width: "100%", marginBottom: "0.5rem", display: "block", maxHeight: 180, objectFit: "cover", opacity: 0.85, filter: "grayscale(20%) contrast(1.1)" }}
          onError={e => e.target.style.display = "none"} />
      )}
      <p className="node-title">{node.title || "???"}</p>
      {node.notes && <p className="node-notes">{node.notes}</p>}
      <div className="nc tl"/><div className="nc tr"/><div className="nc bl"/><div className="nc br"/>
    </div>
  );
}

function EditModal({ node, onSave, onCancel }) {
  const nt = NODE_TYPES.find(t => t.id === node.type) || NODE_TYPES[0];
  const [form, setForm] = useState({ ...node });
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span style={{ color: nt.border, fontFamily: "monospace" }}>{nt.icon}</span>
          <span className="modal-title-text">Edit File</span>
        </div>
        <div className="modal-type-row">
          {NODE_TYPES.map(t => (
            <span key={t.id} className={`mtype-opt ${form.type === t.id ? "sel" : ""}`}
              style={{ "--mc": t.border }}
              onClick={() => setForm(f => ({ ...f, type: t.id }))}>
              {t.icon} {t.label}
            </span>
          ))}
        </div>
        <label className="modal-label">Name / Title</label>
        <input className="modal-input" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Unknown subject..." autoFocus />
        <label className="modal-label">Notes</label>
        <textarea className="modal-input" rows={3} value={form.notes || ""}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="What do we know..." />
        <label className="modal-label">Image URL</label>
        <input className="modal-input" value={form.imageUrl || ""}
          onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
          placeholder="https://..." />
        <div className="modal-actions">
          <button className="modal-save-btn" onClick={() => onSave(form)} disabled={!form.title.trim()}>— File It —</button>
          <button className="modal-cancel-btn" onClick={onCancel}>Discard</button>
        </div>
      </div>
    </div>
  );
}

function ConnLabelEditor({ conn, midX, midY, boardOffset, boardScale, onSave, onCancel }) {
  const [val, setVal] = useState(conn.label || "");
  const inputRef = useRef(null);
  const screenX = midX * boardScale + boardOffset.x;
  const screenY = midY * boardScale + boardOffset.y + 50;
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div style={{
      position: "fixed", left: screenX, top: screenY,
      transform: "translate(-50%, -50%)", zIndex: 300,
      background: "#0d0d0d", border: "1px solid #c8a050",
      padding: "0.5rem 0.6rem",
      display: "flex", gap: "0.4rem", alignItems: "center",
      boxShadow: "0 0 24px rgba(200,160,80,0.15)",
    }}>
      <input ref={inputRef} value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onCancel(); }}
        placeholder="Connection..."
        style={{
          fontFamily: "'Courier Prime', monospace", fontSize: "0.8rem",
          border: "none", borderBottom: "1px solid #c8a050",
          background: "transparent", color: "#f0e6c8",
          outline: "none", width: "130px", padding: "0.2rem", letterSpacing: "0.03em",
        }} />
      <button onClick={() => onSave(val)} style={{ fontFamily: "inherit", fontSize: "0.72rem", background: "transparent", color: "#c8a050", border: "1px solid #c8a050", padding: "0.2rem 0.5rem", cursor: "pointer" }}>✓</button>
      <button onClick={onCancel} style={{ fontFamily: "inherit", fontSize: "0.72rem", background: "transparent", color: "#444", border: "1px solid #333", padding: "0.2rem 0.4rem", cursor: "pointer" }}>✕</button>
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
  const [editingConn, setEditingConn] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [boardScale, setBoardScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredConn, setHoveredConn] = useState(null);
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => {
    const unsubNodes = onSnapshot(doc(db, "kv", "cb-nodes"), snap => {
      if (snap.exists()) { try { setNodes(JSON.parse(snap.data().value)); } catch { setNodes([]); } } else { setNodes([]); }
    });
    const unsubConns = onSnapshot(doc(db, "kv", "cb-conns"), snap => {
      if (snap.exists()) { try { setConnections(JSON.parse(snap.data().value)); } catch { setConnections([]); } } else { setConnections([]); }
    });
    setLoaded(true);
    return () => { unsubNodes(); unsubConns(); };
  }, []);

  const saveNodes = u => { setNodes(u); storage.set("cb-nodes", JSON.stringify(u)).catch(() => {}); };
  const saveConns = u => { setConnections(u); storage.set("cb-conns", JSON.stringify(u)).catch(() => {}); };

  const addNode = type => {
    const rect = boardRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
    const x = (-boardOffset.x + rect.width / 2) / boardScale - 80;
    const y = (-boardOffset.y + rect.height / 2) / boardScale - 60;
    const rot = (Math.random() - 0.5) * 4;
    const newNode = { id: makeId(), type, title: "", notes: "", imageUrl: "", x, y, rot };
    saveNodes([...nodes, newNode]);
    setEditingNode(newNode);
    setShowAddMenu(false);
  };

  const updateNode = updated => { saveNodes(nodes.map(n => n.id === updated.id ? { ...n, ...updated } : n)); setEditingNode(null); };

  const deleteNode = useCallback(id => {
    setNodes(prev => { const u = prev.filter(n => n.id !== id); storage.set("cb-nodes", JSON.stringify(u)).catch(() => {}); return u; });
    setConnections(prev => { const u = prev.filter(c => c.a !== id && c.b !== id); storage.set("cb-conns", JSON.stringify(u)).catch(() => {}); return u; });
    if (connectSource === id) setConnectSource(null);
    setSelectedNode(null);
  }, [connectSource]);

  useEffect(() => {
    const onKeyDown = e => {
      if (!selectedNode) return;
      if (e.key === "Delete" || e.key === "Backspace") {
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
    const onMove = ev => {
      if (!dragRef.current) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      setNodes(prev => prev.map(n => n.id === dragRef.current.nodeId ? { ...n, x: dragRef.current.origX + (cx - dragRef.current.startX) / boardScale, y: dragRef.current.origY + (cy - dragRef.current.startY) / boardScale } : n));
    };
    const onUp = () => {
      if (dragRef.current) { setNodes(prev => { storage.set("cb-nodes", JSON.stringify(prev)).catch(() => {}); return prev; }); dragRef.current = null; }
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp);
  }, [mode, nodes, boardScale]);

  const startPan = useCallback(e => {
    if (mode !== "drag" || dragRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    panRef.current = { startX: clientX, startY: clientY, origX: boardOffset.x, origY: boardOffset.y };
    setIsPanning(true);
    const onMove = ev => {
      if (!panRef.current) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      setBoardOffset({ x: panRef.current.origX + cx - panRef.current.startX, y: panRef.current.origY + cy - panRef.current.startY });
    };
    const onUp = () => {
      panRef.current = null; setIsPanning(false);
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp);
  }, [mode, boardOffset]);

  const onWheel = useCallback(e => {
    e.preventDefault();
    setBoardScale(s => Math.min(2, Math.max(0.3, s * (e.deltaY < 0 ? 1.08 : 0.92))));
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const handleReset = useCallback(() => {
    if (nodes.length === 0) { setBoardOffset({ x: 0, y: 0 }); setBoardScale(1); return; }
    const rect = boardRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...xs) + 220, maxY = Math.max(...ys) + 140;
    const cW = maxX - minX, cH = maxY - minY;
    const scale = Math.min(1, (rect.width - 80) / cW, (rect.height - 80) / cH);
    setBoardScale(scale);
    setBoardOffset({ x: rect.width / 2 - (minX + cW / 2) * scale, y: rect.height / 2 - (minY + cH / 2) * scale });
  }, [nodes]);

  const handleNodeClick = (nodeId, e) => {
    e.stopPropagation();
    if (mode === "connect") {
      if (!connectSource) { setConnectSource(nodeId); }
      else if (connectSource !== nodeId) {
        if (!connections.find(c => (c.a === connectSource && c.b === nodeId) || (c.a === nodeId && c.b === connectSource)))
          saveConns([...connections, { id: makeId(), a: connectSource, b: nodeId, label: "" }]);
        setConnectSource(null); setMode("drag");
      }
    } else { setSelectedNode(selectedNode === nodeId ? null : nodeId); }
  };

  const deleteConnection = connId => { saveConns(connections.filter(c => c.id !== connId)); setEditingConn(null); };
  const saveConnLabel = (connId, label) => { saveConns(connections.map(c => c.id === connId ? { ...c, label } : c)); setEditingConn(null); };
  const nodeCenter = node => ({ x: node.x + (node.type === "meme" ? 80 : 75), y: node.y + 55 });

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8a050", fontFamily: "'Courier Prime', monospace", fontSize: "0.9rem", letterSpacing: "0.2em" }}>
      LOADING CASE FILES...
    </div>
  );

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#080808", fontFamily: "'Special Elite', serif", userSelect: "none" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=Courier+Prime:wght@400;700&display=swap');
        * { box-sizing: border-box; }

        .toolbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: #080808; height: 50px;
          border-bottom: 1px solid #1e1a0e;
          padding: 0 1rem;
          display: flex; align-items: center; gap: 0.5rem;
          box-shadow: 0 2px 40px rgba(0,0,0,0.9);
        }
        .toolbar::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 0%, #c8a05055 20%, #c8a050 50%, #c8a05055 80%, transparent 100%);
        }
        .toolbar-brand {
          font-family: 'Courier Prime', monospace; font-weight: 700;
          font-size: 0.85rem; letter-spacing: 0.25em; text-transform: uppercase;
          color: #c8a050; margin: 0; flex-shrink: 0;
          text-shadow: 0 0 20px rgba(200,160,80,0.35);
        }
        .toolbar-brand em { color: #8b2020; font-style: normal; }
        .t-sep { width: 1px; height: 18px; background: #1e1a0e; flex-shrink: 0; }
        .t-btn {
          font-family: 'Courier Prime', monospace; font-weight: 700;
          font-size: 0.68rem; padding: 0.28rem 0.65rem;
          border: 1px solid #1e1a0e; background: transparent;
          color: #444; cursor: pointer;
          letter-spacing: 0.12em; text-transform: uppercase;
          transition: all 0.15s; white-space: nowrap;
        }
        .t-btn:hover { border-color: #c8a050; color: #c8a050; }
        .t-btn.on { border-color: #8b2020; color: #c0392b; background: rgba(139,32,32,0.08); }
        .t-btn.con-on { border-color: #c0392b; color: #e74c3c; background: rgba(192,57,43,0.08); animation: rpulse 1.2s ease-in-out infinite; }
        .t-btn.gold { border-color: #2a2010; color: #c8a050; }
        .t-btn.gold:hover { background: rgba(200,160,80,0.08); border-color: #c8a050; }
        @keyframes rpulse { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 10px rgba(192,57,43,0.35); } }
        .t-count { font-family: 'Courier Prime', monospace; font-size: 0.62rem; color: #282010; margin-left: auto; flex-shrink: 0; letter-spacing: 0.06em; }

        .add-menu {
          position: fixed; top: 52px; left: 50%; transform: translateX(-50%);
          background: #080808; border: 1px solid #1e1a0e;
          padding: 0.6rem; display: flex; gap: 0.35rem; flex-wrap: wrap;
          z-index: 101; box-shadow: 0 8px 50px rgba(0,0,0,0.9); max-width: 90vw;
        }
        .add-menu::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, #c8a05044, transparent);
        }
        .add-type-btn {
          font-family: 'Courier Prime', monospace; font-weight: 700;
          font-size: 0.65rem; padding: 0.3rem 0.55rem;
          border: 1px solid var(--mc); background: transparent; color: var(--mc);
          cursor: pointer; letter-spacing: 0.1em; text-transform: uppercase;
          transition: all 0.15s; display: flex; align-items: center; gap: 0.3rem;
        }
        .add-type-btn:hover { background: var(--mc); color: #080808; }

        .board-bg {
          position: absolute; inset: 0; top: 50px; cursor: grab;
          background-color: #0b0b0b;
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(200,160,80,0.018) 59px, rgba(200,160,80,0.018) 60px),
            repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(200,160,80,0.018) 59px, rgba(200,160,80,0.018) 60px);
        }
        .board-bg.panning { cursor: grabbing; }
        .board-bg.connecting { cursor: crosshair; }
        .board-bg::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%);
        }

        .node-card {
          position: absolute;
          background: var(--nc); border: 1px solid var(--nb);
          padding: 0.75rem 0.8rem 0.7rem; cursor: grab; min-width: 190px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03);
          transition: box-shadow 0.2s;
        }
        .node-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px var(--nb)66, inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .node-card.selected {
          box-shadow: 0 0 0 1px var(--nb), 0 0 22px var(--nb)44, 0 8px 32px rgba(0,0,0,0.85);
        }
        .node-card.connectable { box-shadow: 0 0 0 1px #c0392b, 0 0 18px rgba(192,57,43,0.25); cursor: crosshair; }
        .node-card.connecting-source { box-shadow: 0 0 0 1px #c8a050, 0 0 22px rgba(200,160,80,0.25); }

        .nc { position: absolute; width: 9px; height: 9px; border-color: var(--nb); border-style: solid; opacity: 0.4; }
        .nc.tl { top: -1px; left: -1px; border-width: 1px 0 0 1px; }
        .nc.tr { top: -1px; right: -1px; border-width: 1px 1px 0 0; }
        .nc.bl { bottom: -1px; left: -1px; border-width: 0 0 1px 1px; }
        .nc.br { bottom: -1px; right: -1px; border-width: 0 1px 1px 0; }

        .node-pin {
          width: 9px; height: 9px; border-radius: 50%;
          position: absolute; top: -4px; left: 50%; transform: translateX(-50%);
          border: 1px solid rgba(0,0,0,0.6); z-index: 5;
        }
        .node-type-row { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.35rem; margin-top: 0.1rem; }
        .node-type-icon { font-size: 0.75rem; line-height: 1; flex-shrink: 0; font-family: monospace; }
        .node-type-label {
          font-family: 'Courier Prime', monospace; font-size: 0.55rem;
          text-transform: uppercase; letter-spacing: 0.2em; color: var(--nb); opacity: 0.6; flex: 1;
        }
        .node-btns { display: flex; gap: 0.12rem; opacity: 0; transition: opacity 0.15s; }
        .node-card:hover .node-btns { opacity: 1; }
        .node-btn {
          font-size: 0.65rem; background: transparent; border: none;
          color: #333; cursor: pointer; padding: 0.08rem 0.22rem; transition: color 0.12s; font-family: monospace;
        }
        .node-btn:hover { color: #c8a050; }
        .node-btn.del:hover { color: #c0392b; }
        .node-title {
          font-family: 'Special Elite', serif; font-size: 0.98rem;
          color: var(--nt, #f0e6c8); margin: 0 0 0.25rem;
          line-height: 1.3; word-break: break-word;
        }
        .node-notes {
          font-family: 'Courier Prime', monospace; font-size: 0.7rem;
          color: #555; margin: 0; line-height: 1.5; word-break: break-word;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
        }

        .str-svg { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
        .str-hit { fill: none; stroke: transparent; stroke-width: 16; cursor: pointer; pointer-events: stroke; }
        .str-vis { fill: none; stroke-linecap: round; pointer-events: stroke; cursor: pointer; transition: stroke 0.15s, stroke-width 0.15s, opacity 0.15s; }
        .conn-lbl-bg { fill: #0b0b0b; }
        .conn-lbl-txt {
          font-family: 'Courier Prime', monospace; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          fill: #c8a050; text-anchor: middle; dominant-baseline: central; pointer-events: none;
        }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.88);
          z-index: 200; display: flex; align-items: center; justify-content: center;
        }
        .edit-modal {
          background: #0a0a0a; border: 1px solid #2a2010;
          padding: 1.4rem 1.5rem; width: min(360px, 92vw);
          box-shadow: 0 0 80px rgba(0,0,0,0.95); position: relative;
        }
        .edit-modal::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, #c8a050, transparent);
        }
        .modal-header {
          display: flex; align-items: center; gap: 0.6rem;
          margin-bottom: 1rem; padding-bottom: 0.7rem; border-bottom: 1px solid #161208;
        }
        .modal-title-text {
          font-family: 'Courier Prime', monospace; font-weight: 700; font-size: 0.72rem;
          color: #c8a050; letter-spacing: 0.22em; text-transform: uppercase;
        }
        .modal-type-row { display: flex; gap: 0.28rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .mtype-opt {
          font-family: 'Courier Prime', monospace; font-weight: 700; font-size: 0.6rem;
          padding: 0.22rem 0.48rem; border: 1px solid #1e1e1e;
          background: transparent; color: #3a3a3a; cursor: pointer;
          letter-spacing: 0.08em; text-transform: uppercase; transition: all 0.12s;
        }
        .mtype-opt:hover { border-color: var(--mc); color: var(--mc); }
        .mtype-opt.sel { border-color: var(--mc); color: var(--mc); background: rgba(255,255,255,0.02); }
        .modal-label {
          font-family: 'Courier Prime', monospace; font-size: 0.58rem; font-weight: 700;
          color: #2a2010; letter-spacing: 0.2em; text-transform: uppercase; display: block; margin-bottom: 0.2rem;
        }
        .modal-input {
          width: 100%; background: transparent; border: none;
          border-bottom: 1px solid #2a2010; color: #c8a050;
          font-family: 'Courier Prime', monospace; font-size: 0.86rem;
          padding: 0.38rem 0; outline: none; resize: vertical;
          margin-bottom: 0.85rem; display: block; line-height: 1.5; letter-spacing: 0.03em;
        }
        .modal-input::placeholder { color: #252010; }
        .modal-input:focus { border-bottom-color: #c8a050; }
        .modal-actions { display: flex; gap: 0.5rem; margin-top: 0.3rem; }
        .modal-save-btn {
          font-family: 'Courier Prime', monospace; font-weight: 700; font-size: 0.7rem;
          background: transparent; color: #c8a050; border: 1px solid #c8a050;
          padding: 0.48rem 1rem; cursor: pointer;
          letter-spacing: 0.16em; text-transform: uppercase; flex: 1; transition: all 0.15s;
        }
        .modal-save-btn:hover:not(:disabled) { background: rgba(200,160,80,0.08); }
        .modal-save-btn:disabled { opacity: 0.18; cursor: not-allowed; }
        .modal-cancel-btn {
          font-family: 'Courier Prime', monospace; font-size: 0.62rem;
          background: transparent; border: 1px solid #1e1e1e; color: #333;
          padding: 0.48rem 0.75rem; cursor: pointer;
          letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.15s;
        }
        .modal-cancel-btn:hover { border-color: #333; color: #555; }

        .hint-bar {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: #060606; border-top: 1px solid #111008;
          padding: 0.28rem 1rem; display: flex; gap: 1.2rem; flex-wrap: wrap;
          z-index: 50; align-items: center;
        }
        .hint {
          font-family: 'Courier Prime', monospace; font-size: 0.6rem;
          color: #252010; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.3rem;
        }
        .hint kbd {
          color: #2e2810; border: 1px solid #1e1808; padding: 0 0.28rem;
          font-family: inherit; font-size: 0.58rem;
        }
      `}</style>

      {/* Toolbar */}
      <div className="toolbar">
        <p className="toolbar-brand">Case <em>■</em> File</p>
        <div className="t-sep" />
        <button className={`t-btn ${mode === "drag" ? "on" : ""}`} onClick={() => { setMode("drag"); setConnectSource(null); }}>▸ Move</button>
        <button className={`t-btn ${mode === "connect" ? "con-on" : ""}`} onClick={() => { setMode(mode === "connect" ? "drag" : "connect"); setConnectSource(null); }}>
          {mode === "connect" ? (connectSource ? "▸ Pick target" : "▸ Pick source") : "◈ Connect"}
        </button>
        <button className={`t-btn ${mode === "delete-conn" ? "on" : ""}`} onClick={() => { setMode(mode === "delete-conn" ? "drag" : "delete-conn"); setConnectSource(null); }}>✂ Cut</button>
        <div className="t-sep" />
        <button className="t-btn gold" onClick={() => setShowAddMenu(v => !v)}>+ Add</button>
        <button className="t-btn" onClick={handleReset}>◎ Reset</button>
        <span className="t-count">{nodes.length} nodes · {connections.length} links</span>
      </div>

      {showAddMenu && (
        <div className="add-menu">
          {NODE_TYPES.map(t => (
            <button key={t.id} className="add-type-btn" style={{ "--mc": t.border }} onClick={() => addNode(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      )}

      <div ref={boardRef} className={`board-bg ${isPanning ? "panning" : ""} ${mode === "connect" ? "connecting" : ""}`}
        onMouseDown={startPan} onTouchStart={startPan}
        onClick={() => { setShowAddMenu(false); if (mode !== "connect") setSelectedNode(null); }}>
        <div style={{ position: "absolute", transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${boardScale})`, transformOrigin: "0 0", width: "3000px", height: "2000px" }}>

          <svg className="str-svg" width="3000" height="2000">
            <defs>
              <filter id="sg">
                <feGaussianBlur stdDeviation="2.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {connections.map(conn => {
              const a = nodes.find(n => n.id === conn.a);
              const b = nodes.find(n => n.id === conn.b);
              if (!a || !b) return null;
              const ca = nodeCenter(a), cb = nodeCenter(b);
              const path = stringPath(ca.x, ca.y, cb.x, cb.y);
              const mid = bezierMid(ca.x, ca.y, cb.x, cb.y);
              const isHov = hoveredConn === conn.id;
              const hasLbl = conn.label && conn.label.trim();
              const lw = hasLbl ? Math.max(60, conn.label.trim().length * 7.5 + 20) : 0;
              return (
                <g key={conn.id}>
                  <path d={path} className="str-hit"
                    onMouseEnter={() => setHoveredConn(conn.id)} onMouseLeave={() => setHoveredConn(null)}
                    onClick={e => { e.stopPropagation(); if (mode === "delete-conn") deleteConnection(conn.id); else setEditingConn({ conn, midX: mid.x, midY: mid.y }); }} />
                  <path d={path} className="str-vis"
                    style={{ stroke: isHov ? "#e74c3c" : "#8b2020", strokeWidth: isHov ? 2 : 1.3, opacity: isHov ? 1 : 0.75, filter: isHov ? "url(#sg)" : "none" }}
                    onMouseEnter={() => setHoveredConn(conn.id)} onMouseLeave={() => setHoveredConn(null)}
                    onClick={e => { e.stopPropagation(); if (mode === "delete-conn") deleteConnection(conn.id); else setEditingConn({ conn, midX: mid.x, midY: mid.y }); }} />
                  {hasLbl && (
                    <g style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); setEditingConn({ conn, midX: mid.x, midY: mid.y }); }}>
                      <rect x={mid.x - lw / 2} y={mid.y - 10} width={lw} height={20} rx="0"
                        className="conn-lbl-bg" style={{ stroke: "#c8a050", strokeWidth: 0.5 }} />
                      <text x={mid.x} y={mid.y} className="conn-lbl-txt">{conn.label.trim()}</text>
                    </g>
                  )}
                  {!hasLbl && isHov && mode !== "delete-conn" && (
                    <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: "9px", fill: "#c8a05077", fontFamily: "'Courier Prime', monospace", pointerEvents: "none", letterSpacing: "0.12em" }}>
                      + LABEL
                    </text>
                  )}
                  {isHov && mode === "delete-conn" && (
                    <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: "13px", fill: "#c0392b", fontFamily: "monospace", pointerEvents: "none" }}>✕</text>
                  )}
                </g>
              );
            })}
          </svg>

          {nodes.map(node => (
            <NodeCard key={node.id} node={node}
              selected={selectedNode === node.id}
              connecting={connectSource === node.id}
              isConnecting={mode === "connect" && connectSource && connectSource !== node.id}
              onMouseDown={e => startDrag(node.id, e)}
              onClick={e => handleNodeClick(node.id, e)}
              onDoubleClick={e => { e.stopPropagation(); if (mode === "drag") setEditingNode({ ...node }); }}
              onEdit={() => setEditingNode({ ...node })}
              onDelete={() => deleteNode(node.id)} />
          ))}
        </div>
      </div>

      {editingNode && <EditModal node={editingNode} onSave={updateNode} onCancel={() => setEditingNode(null)} />}
      {editingConn && (
        <ConnLabelEditor conn={editingConn.conn}
          midX={editingConn.midX} midY={editingConn.midY}
          boardOffset={boardOffset} boardScale={boardScale}
          onSave={label => saveConnLabel(editingConn.conn.id, label)}
          onCancel={() => setEditingConn(null)} />
      )}

      <div className="hint-bar">
        <div className="hint"><kbd>drag</kbd> move</div>
        <div className="hint"><kbd>dbl-click</kbd> edit</div>
        <div className="hint"><kbd>del</kbd> delete selected</div>
        <div className="hint"><kbd>click string</kbd> label</div>
        <div className="hint"><kbd>scroll</kbd> zoom</div>
      </div>
    </div>
  );
}
