import { useEffect, useMemo } from 'react';
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
import { Bot, GitBranch, Plus } from 'lucide-react';
import type { Agent } from '../../api/client';
import { AgentNode } from './AgentNode';
import { ConditionNode } from './ConditionNode';

const nodeTypes = { agent: AgentNode, condition: ConditionNode };

function toFlowNodes(value: any): Node[] {
  const sourceNodes = value?.nodes?.length
    ? value.nodes
    : [
        { id: 'start', type: 'start', position: { x: 50, y: 100 } },
        { id: 'end', type: 'end', position: { x: 700, y: 100 } },
      ];

  return sourceNodes.map((n: any, index: number) => ({
    id: n.id,
    type:
      n.type === 'agent'
        ? 'agent'
        : n.type === 'condition'
          ? 'condition'
          : n.type === 'end'
            ? 'output'
            : 'input',
    position: n.position ?? { x: 120 + index * 220, y: 140 },
    data: { ...n, label: n.type === 'start' ? 'START' : n.type === 'end' ? 'END' : n.label },
    style:
      n.type === 'start' || n.type === 'end'
        ? {
            background: n.type === 'start' ? 'rgba(79,142,247,0.15)' : 'rgba(34,197,94,0.15)',
            border: `2px solid ${n.type === 'start' ? 'rgba(79,142,247,0.5)' : 'rgba(34,197,94,0.5)'}`,
            borderRadius: '12px',
            color: n.type === 'start' ? '#76aaff' : '#4ade80',
            fontSize: '12px',
            fontWeight: 700,
            padding: '10px 20px',
            minWidth: '80px',
            textAlign: 'center' as const,
          }
        : undefined,
  }));
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
  const nodeIds = new Set(ns.map((n) => n.id));
  return {
    nodes: ns.map((n) => {
      const type = n.type === 'input' ? 'start' : n.type === 'output' ? 'end' : n.type;
      const node: any = { id: n.id, type, position: n.position };
      if (type === 'agent') node.agent_id = (n.data as any).agent_id;
      if (type === 'condition') node.condition_expr = (n.data as any).condition_expr ?? '';
      return node;
    }),
    edges: es
      .filter((e) => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => {
        const edge: any = { id: e.id, source: e.source, target: e.target };
        if (e.label) edge.label = e.label;
        if ((e as any).feedback_loop) edge.feedback_loop = true;
        return edge;
      }),
  };
}

export function WorkflowCanvas({
  agents,
  value,
  onChange,
}: {
  agents: Agent[];
  value: any;
  onChange: (graph: any) => void;
}) {
  const valueKey = useMemo(() => JSON.stringify(value ?? {}), [value]);
  const [nodes, setNodes] = useNodesState(toFlowNodes(value));
  const [edges, setEdges] = useEdgesState(toFlowEdges(value));

  useEffect(() => {
    setNodes(toFlowNodes(value));
    setEdges(toFlowEdges(value));
  }, [valueKey, setEdges, setNodes]);

  function emit(ns: Node[], es: Edge[]) {
    onChange(serializeGraph(ns, es));
  }

  function handleNodesChange(changes: NodeChange[]) {
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      emit(next, edges);
      return next;
    });
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    setEdges((current) => {
      const next = applyEdgeChanges(changes, current);
      emit(nodes, next);
      return next;
    });
  }

  function onConnect(c: Connection) {
    setEdges((current) => {
      const next = addEdge(
        { ...c, id: `e-${Date.now()}`, animated: true, style: { stroke: '#4f8ef7', strokeWidth: 2 } },
        current
      );
      emit(nodes, next);
      return next;
    });
  }

  function addAgent(a: Agent) {
    const next = [
      ...nodes,
      {
        id: `agent-${Date.now()}`,
        type: 'agent',
        position: { x: 220 + Math.random() * 80, y: 160 + Math.random() * 80 },
        data: { ...a, agent_id: a.id },
      },
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
        position: { x: 420, y: 160 },
        data: { condition_expr: "agent_outputs['agent-id'] contains 'value'" },
      },
    ];
    setNodes(next);
    emit(next, edges);
  }

  return (
    <div className="grid h-[calc(100vh-180px)] grid-cols-[220px_1fr] border border-border rounded-xl overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="overflow-y-auto border-r border-border bg-surface p-3 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted px-1 py-1">
            Add Nodes
          </p>
          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-2 w-full rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            <GitBranch size={14} />
            Add Condition
          </button>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted px-1 py-1">
            Agents ({agents.length})
          </p>
          <div className="space-y-1.5">
            {agents.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => addAgent(a)}
                className="flex items-center gap-2.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  <Bot size={13} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {a.name}
                  </div>
                  <div className="text-[10px] text-muted truncate">{a.model}</div>
                </div>
                <Plus size={12} className="ml-auto text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
            {agents.length === 0 && (
              <p className="text-xs text-muted/60 px-2 py-2">No agents yet. Create agents first.</p>
            )}
          </div>
        </div>
      </aside>

      {/* Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: '#0f1724' }}
      >
        <Background variant={BackgroundVariant.Dots} color="#2e4565" gap={20} size={1.5} />
        <Controls />
        <MiniMap
          nodeColor={(n) =>
            n.type === 'agent'
              ? '#4f8ef7'
              : n.type === 'condition'
                ? '#f97316'
                : n.type === 'input'
                  ? '#4f8ef7'
                  : '#22c55e'
          }
          maskColor="rgba(14, 22, 35, 0.75)"
        />
      </ReactFlow>
    </div>
  );
}
