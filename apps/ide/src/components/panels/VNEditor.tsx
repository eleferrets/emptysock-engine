import React from 'react';

type NodeType = 'dialogue' | 'choice';

interface VNNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  speaker?: string;
  text: string;
  options?: string[];
}

interface VNEdge {
  id: string;
  from: string;
  fromPort: number;
  to: string;
}

const INITIAL_NODES: VNNode[] = [
  { id: 'n1', type: 'dialogue', x: 60, y: 80, speaker: 'Hero', text: 'Hello, traveller.' },
  { id: 'n2', type: 'choice', x: 320, y: 80, text: 'Choose a response', options: ['Who are you?', 'Goodbye.'] },
  { id: 'n3', type: 'dialogue', x: 580, y: 40, speaker: 'Hero', text: 'I am the last guardian.' },
  { id: 'n4', type: 'dialogue', x: 580, y: 160, speaker: 'Hero', text: 'Safe travels.' },
];

const INITIAL_EDGES: VNEdge[] = [
  { id: 'e1', from: 'n1', fromPort: 0, to: 'n2' },
  { id: 'e2', from: 'n2', fromPort: 0, to: 'n3' },
  { id: 'e3', from: 'n2', fromPort: 1, to: 'n4' },
];

const NODE_W = 220;
const NODE_H = 100;

export function VNEditor(): React.ReactElement {
  const [nodes, setNodes] = React.useState<VNNode[]>(INITIAL_NODES);
  const [edges, setEdges] = React.useState<VNEdge[]>(INITIAL_EDGES);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<{ id: string; ox: number; oy: number } | null>(null);
  const [editNode, setEditNode] = React.useState<VNNode | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const nodeById = (id: string): VNNode | undefined => nodes.find(n => n.id === id);

  const portPos = (node: VNNode, port: number, side: 'in' | 'out'): { x: number; y: number } => {
    const portCount = side === 'out' ? Math.max(1, node.options?.length ?? 1) : 1;
    const spacing = NODE_H / (portCount + 1);
    return {
      x: side === 'in' ? node.x : node.x + NODE_W,
      y: node.y + spacing * (port + 1),
    };
  };

  const edgePath = (edge: VNEdge): string => {
    const from = nodeById(edge.from);
    const to = nodeById(edge.to);
    if (!from || !to) return '';
    const p1 = portPos(from, edge.fromPort, 'out');
    const p2 = portPos(to, 0, 'in');
    const cx = (p1.x + p2.x) / 2;
    return `M${p1.x},${p1.y} C${cx},${p1.y} ${cx},${p2.y} ${p2.x},${p2.y}`;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!dragging) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - dragging.ox;
    const y = e.clientY - rect.top - dragging.oy;
    setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x, y } : n));
  };

  const addNode = (type: NodeType): void => {
    const id = `n${Date.now()}`;
    setNodes(prev => [...prev, { id, type, x: 100 + Math.random() * 200, y: 100 + Math.random() * 200, text: type === 'dialogue' ? 'New dialogue...' : 'Choose...', speaker: type === 'dialogue' ? 'Speaker' : undefined, options: type === 'choice' ? ['Option A', 'Option B'] : undefined }]);
  };

  const deleteSelected = (): void => {
    if (!selected) return;
    setNodes(prev => prev.filter(n => n.id !== selected));
    setEdges(prev => prev.filter(e => e.from !== selected && e.to !== selected));
    setSelected(null);
  };

  const exportJSON = (): void => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dialogue.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button onClick={() => addNode('dialogue')} style={{ padding: '3px 10px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>+ Dialogue</button>
        <button onClick={() => addNode('choice')} style={{ padding: '3px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>+ Choice</button>
        <button onClick={deleteSelected} disabled={!selected} style={{ padding: '3px 10px', background: selected ? '#dc2626' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: selected ? 'pointer' : 'default' }}>Delete</button>
        <button onClick={exportJSON} style={{ padding: '3px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer', marginLeft: 'auto' }}>Export JSON</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '100%', minWidth: 1200, minHeight: 600 }}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(null)}
          onClick={() => setSelected(null)}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--accent)" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map(edge => (
            <path key={edge.id} d={edgePath(edge)} fill="none" stroke="var(--accent)" strokeWidth={1.5}
              markerEnd="url(#arrow)" strokeDasharray={undefined} />
          ))}

          {/* Nodes */}
          {nodes.map(node => (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              style={{ cursor: 'grab' }}
              onMouseDown={e => {
                e.stopPropagation();
                setSelected(node.id);
                const rect = svgRef.current!.getBoundingClientRect();
                setDragging({ id: node.id, ox: e.clientX - rect.left - node.x, oy: e.clientY - rect.top - node.y });
              }}
              onDoubleClick={e => { e.stopPropagation(); setEditNode({ ...node }); }}
            >
              <rect width={NODE_W} height={NODE_H} rx={6}
                fill={node.type === 'dialogue' ? '#1e1b4b' : '#1a1a2e'}
                stroke={selected === node.id ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}
                strokeWidth={selected === node.id ? 2 : 1} />
              <text x={8} y={18} fill={node.type === 'dialogue' ? '#a78bfa' : '#f87171'} fontSize={10} fontWeight={600}>
                {node.type === 'dialogue' ? `🗨 ${node.speaker ?? ''}` : '🔀 Choice'}
              </text>
              <foreignObject x={6} y={24} width={NODE_W - 12} height={NODE_H - 30}>
                <div style={{ fontSize: 11, color: '#e2e8f0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {node.text}
                </div>
              </foreignObject>
              {/* Input port */}
              <circle cx={0} cy={NODE_H / 2} r={5} fill="#334155" stroke="var(--accent)" strokeWidth={1.5} />
              {/* Output ports */}
              {(node.options ?? [null]).map((opt, i) => {
                const portCount = node.options?.length ?? 1;
                const spacing = NODE_H / (portCount + 1);
                const py = spacing * (i + 1);
                return (
                  <g key={i}>
                    <circle cx={NODE_W} cy={py} r={5} fill="#334155" stroke="#a78bfa" strokeWidth={1.5} />
                    {opt !== null && <text x={NODE_W - 8} y={py + 4} textAnchor="end" fill="#94a3b8" fontSize={9}>{opt}</text>}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Edit modal */}
      {editNode !== null && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, width: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Edit Node</div>
            {editNode.type === 'dialogue' && (
              <input value={editNode.speaker ?? ''} onChange={e => setEditNode(n => n ? { ...n, speaker: e.target.value } : n)}
                placeholder="Speaker" style={{ padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
            )}
            <textarea value={editNode.text} rows={4} onChange={e => setEditNode(n => n ? { ...n, text: e.target.value } : n)}
              style={{ padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', resize: 'vertical' }} />
            {editNode.type === 'choice' && editNode.options?.map((opt, i) => (
              <input key={i} value={opt} onChange={e => setEditNode(n => { if (!n?.options) return n; const opts = [...n.options]; opts[i] = e.target.value; return { ...n, options: opts }; })}
                placeholder={`Option ${i + 1}`} style={{ padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setNodes(prev => prev.map(n => n.id === editNode.id ? editNode : n)); setEditNode(null); }}
                style={{ flex: 1, padding: '5px 0', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditNode(null)}
                style={{ flex: 1, padding: '5px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
