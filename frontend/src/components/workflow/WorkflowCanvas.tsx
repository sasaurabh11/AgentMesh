import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from 'react-flow-renderer';
import { Bot, GitBranch, GripVertical, Plus } from 'lucide-react';
import type { Agent } from '../../api/client';
import { AgentNode } from './AgentNode';
import { ConditionNode } from './ConditionNode';

const nodeTypes = { agent: AgentNode, condition: ConditionNode };

const DRAG_KEY = 'application/agentmesh-agent';

function toFlowNodes(value: any, agents: Agent[] = []): Node[] {
  const sourceNodes = value?.nodes?.length
    ? value.nodes
    : [
        { id: 'start', type: 'start', position: { x: 80,  y: 100 } },
        { id: 'end',   type: 'end',   position: { x: 700, y: 300 } },
      ];

  return sourceNodes.map((n: any, index: number) => {
    // For saved workflows, agent nodes only have agent_id — look up full data
    let nodeData = { ...n };
    if (n.type === 'agent' && n.agent_id) {
      const full = agents.find(a => a.id === n.agent_id);
      if (full) nodeData = { ...full, ...nodeData, agent_id: n.agent_id };
    }

    return {
      id: n.id,
      type:
        n.type === 'agent'       ? 'agent'
        : n.type === 'condition' ? 'condition'
        : n.type === 'end'       ? 'output'
        : 'input',
      position: n.position ?? { x: 120 + index * 220, y: 140 },
      data: { ...nodeData, label: n.type === 'start' ? 'START' : n.type === 'end' ? 'END' : nodeData.label },
      style:
        n.type === 'start' || n.type === 'end'
          ? {
              background: n.type === 'start' ? 'rgba(79,142,247,0.15)' : 'rgba(34,197,94,0.15)',
              border: `2px solid ${n.type === 'start' ? 'rgba(79,142,247,0.55)' : 'rgba(34,197,94,0.55)'}`,
              borderRadius: '14px',
              color: n.type === 'start' ? '#76aaff' : '#4ade80',
              fontSize: '13px', fontWeight: 800,
              padding: '12px 28px', minWidth: '90px',
              textAlign: 'center' as const,
              fontFamily: 'Inter, ui-sans-serif, sans-serif',
              letterSpacing: '0.08em',
            }
          : undefined,
    };
  });
}

function toFlowEdges(value: any): Edge[] {
  return (value?.edges ?? []).map((e: any) => ({
    ...e,
    id: e.id ?? `${e.source}-${e.target}`,
    animated: true,
    label: e.label,
    style: { stroke: '#4f8ef7', strokeWidth: 2 },
    labelStyle: { fill: '#aec6e0', fontSize: 11 },
    labelBgStyle: { fill: '#1c2c42', fillOpacity: 0.9 },
  }));
}

function serializeGraph(ns: Node[], es: Edge[]) {
  const nodeIds = new Set(ns.map(n => n.id));
  return {
    nodes: ns.map(n => {
      const type = n.type === 'input' ? 'start' : n.type === 'output' ? 'end' : n.type;
      const node: any = { id: n.id, type, position: n.position };
      if (type === 'agent')     node.agent_id       = (n.data as any).agent_id;
      if (type === 'condition') node.condition_expr = (n.data as any).condition_expr ?? '';
      return node;
    }),
    edges: es
      .filter(e => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
      .map(e => {
        const edge: any = { id: e.id, source: e.source, target: e.target };
        if (e.label) edge.label = e.label;
        if ((e as any).feedback_loop) edge.feedback_loop = true;
        return edge;
      }),
  };
}

export function WorkflowCanvas({
  agents, value, onChange,
}: {
  agents: Agent[];
  value: any;
  onChange: (graph: any) => void;
}) {
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const valueKey  = useMemo(() => JSON.stringify(value ?? {}), [value]);
  const agentsKey = useMemo(() => agents.map(a => a.id).join(','), [agents]);

  const [nodes, setNodes] = useNodesState(toFlowNodes(value, agents));
  const [edges, setEdges] = useEdgesState(toFlowEdges(value));

  useEffect(() => {
    setNodes(toFlowNodes(value, agents));
    setEdges(toFlowEdges(value));
  }, [valueKey, agentsKey, setEdges, setNodes]);

  const emit = useCallback((ns: Node[], es: Edge[]) => {
    onChange(serializeGraph(ns, es));
  }, [onChange]);

  function handleNodesChange(changes: NodeChange[]) {
    setNodes(cur => {
      const next = applyNodeChanges(changes, cur);
      emit(next, edges);
      return next;
    });
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    setEdges(cur => {
      const next = applyEdgeChanges(changes, cur);
      emit(nodes, next);
      return next;
    });
  }

  function onConnect(c: Connection) {
    setEdges(cur => {
      const next = addEdge(
        { ...c, id: `e-${Date.now()}`, animated: true, style: { stroke: '#4f8ef7', strokeWidth: 2 } },
        cur,
      );
      emit(nodes, next);
      return next;
    });
  }

  function addAgentNode(a: Agent, position?: { x: number; y: number }) {
    const pos = position ?? { x: 260 + Math.random() * 120, y: 180 + Math.random() * 80 };
    const next = [
      ...nodes,
      { id: `agent-${Date.now()}`, type: 'agent', position: pos, data: { ...a, agent_id: a.id } },
    ];
    setNodes(next);
    emit(next, edges);
  }

  function addCondition() {
    const next = [
      ...nodes,
      {
        id: `condition-${Date.now()}`,
        type: 'condition',
        position: { x: 420, y: 200 },
        data: { condition_expr: "agent_outputs['agent-id'] contains 'value'" },
      },
    ];
    setNodes(next);
    emit(next, edges);
  }

  /* ── Drag-and-drop ── */
  function onDragStart(e: React.DragEvent, agent: Agent) {
    e.dataTransfer.setData(DRAG_KEY, JSON.stringify(agent));
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!rfInstance || !wrapperRef.current) return;
    const raw = e.dataTransfer.getData(DRAG_KEY);
    if (!raw) return;
    const agent: Agent = JSON.parse(raw);
    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = rfInstance.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    addAgentNode(agent, position);
  }

  return (
    <div className="grid h-[calc(100vh-180px)] grid-cols-[230px_1fr] border border-border rounded-xl overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="flex flex-col overflow-hidden border-r border-border bg-surface">

        {/* Condition button */}
        <div className="p-3 border-b border-border">
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            Add Nodes
          </p>
          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-2 w-full rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent hover:bg-accent/20 transition-colors"
          >
            <GitBranch size={14} /> Add Condition
          </button>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
            Agents ({agents.length}) — drag or click
          </p>

          {agents.map(a => (
            <div
              key={a.id}
              draggable
              onDragStart={e => onDragStart(e, a)}
              onClick={() => addAgentNode(a)}
              className="flex items-center gap-2.5 w-full rounded-lg border border-border bg-card px-2.5 py-2.5 cursor-grab active:cursor-grabbing hover:border-primary/50 hover:bg-primary/[0.07] transition-all group select-none"
            >
              {/* Drag handle */}
              <GripVertical size={13} className="text-muted shrink-0 group-hover:text-muted-light transition-colors" />

              {/* Bot icon */}
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <Bot size={12} className="text-primary" />
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary-light transition-colors">
                  {a.name}
                </p>
                <p className="text-[10px] text-muted truncate">{a.model}</p>
              </div>

              <Plus size={12} className="text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}

          {agents.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted text-center">
              No agents yet.<br />Create agents first.
            </p>
          )}
        </div>
      </aside>

      {/* ── Canvas ── */}
      <div ref={wrapperRef} className="relative h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          style={{ background: '#0f1724' }}
        >
          <Background variant={BackgroundVariant.Dots} color="#2e4565" gap={22} size={1.5} />
          <Controls />
          <MiniMap
            nodeColor={n =>
              n.type === 'agent'     ? '#4f8ef7'
              : n.type === 'condition' ? '#f97316'
              : n.type === 'input'     ? '#4f8ef7'
              : '#22c55e'
            }
            maskColor="rgba(15,23,36,0.75)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
