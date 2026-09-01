import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import type { Connection, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── Custom node components ──────────────────────────────────────────────────

const SceneNode: React.FC<{ data: { label: string } }> = ({ data }) => (
  <div
    style={{
      background: '#6d28d9',
      color: '#fff',
      border: '1px solid #7c3aed',
      borderRadius: 8,
      padding: '8px 16px',
      minWidth: 120,
      textAlign: 'center',
      fontWeight: 600,
      fontSize: 13,
    }}
  >
    <Handle type="source" position={Position.Bottom} />
    {data.label}
  </div>
);

const EntityNode: React.FC<{ data: { label: string } }> = ({ data }) => (
  <div
    style={{
      background: '#1d4ed8',
      color: '#fff',
      border: '1px solid #2563eb',
      borderRadius: 8,
      padding: '8px 16px',
      minWidth: 120,
      textAlign: 'center',
      fontWeight: 600,
      fontSize: 13,
    }}
  >
    <Handle type="target" position={Position.Top} />
    {data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const ComponentNode: React.FC<{ data: { label: string } }> = ({ data }) => (
  <div
    style={{
      background: '#166534',
      color: '#fff',
      border: '1px solid #16a34a',
      borderRadius: 8,
      padding: '8px 16px',
      minWidth: 120,
      textAlign: 'center',
      fontSize: 13,
    }}
  >
    <Handle type="target" position={Position.Top} />
    {data.label}
  </div>
);

// ── Node type registry ──────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  sceneNode: SceneNode,
  entityNode: EntityNode,
  componentNode: ComponentNode,
};

// ── Default graph ───────────────────────────────────────────────────────────

const INITIAL_NODES = [
  { id: 'scene-1', type: 'sceneNode', position: { x: 300, y: 40 }, data: { label: 'Scene' } },
  { id: 'entity-1', type: 'entityNode', position: { x: 300, y: 160 }, data: { label: 'Entity' } },
  { id: 'comp-transform', type: 'componentNode', position: { x: 100, y: 300 }, data: { label: 'Transform' } },
  { id: 'comp-sprite', type: 'componentNode', position: { x: 300, y: 300 }, data: { label: 'Sprite' } },
  { id: 'comp-physics', type: 'componentNode', position: { x: 500, y: 300 }, data: { label: 'PhysicsBody' } },
];

const INITIAL_EDGES = [
  { id: 'e-scene-entity', source: 'scene-1', target: 'entity-1' },
  { id: 'e-entity-transform', source: 'entity-1', target: 'comp-transform' },
  { id: 'e-entity-sprite', source: 'entity-1', target: 'comp-sprite' },
];

// ── Component types available to "Add Component" ────────────────────────────

const COMPONENT_TYPES = ['Transform', 'Sprite', 'PhysicsBody', 'Animator', 'CharacterController'];

// ── Panel ───────────────────────────────────────────────────────────────────

let _nodeIdCounter = 100;
function nextId(): string {
  return `node-${_nodeIdCounter++}`;
}

export function VisualScriptEditor(): React.ReactElement {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges],
  );

  const addEntity = useCallback(() => {
    const id = nextId();
    setNodes(ns => [
      ...ns,
      {
        id,
        type: 'entityNode',
        position: { x: 200 + Math.random() * 200, y: 160 + Math.random() * 60 },
        data: { label: 'Entity' },
      },
    ]);
  }, [setNodes]);

  const addComponent = useCallback(
    (type: string) => {
      const id = nextId();
      setNodes(ns => [
        ...ns,
        {
          id,
          type: 'componentNode',
          position: { x: 100 + Math.random() * 400, y: 300 + Math.random() * 80 },
          data: { label: type },
        },
      ]);
    },
    [setNodes],
  );

  const clear = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={addEntity}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Add Entity
        </button>

        <select
          defaultValue=""
          onChange={e => {
            if (e.target.value) addComponent(e.target.value);
            e.target.value = '';
          }}
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          <option value="" disabled>
            Add Component
          </option>
          {COMPONENT_TYPES.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button
          onClick={clear}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Clear
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          Visual wiring — drag to connect nodes to build your scene
        </span>
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
