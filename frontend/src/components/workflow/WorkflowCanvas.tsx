import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Node,
} from 'react-flow-renderer';
import type { Agent } from '../../api/client';
import { AgentNode } from './AgentNode';
import { ConditionNode } from './ConditionNode';
const nodeTypes = { agent: AgentNode, condition: ConditionNode };
export function WorkflowCanvas({
  agents,
  value,
  onChange,
}: {
  agents: Agent[];
  value: any;
  onChange: (graph: any) => void;
}) {
  const initialNodes = (
    value?.nodes ?? [
      { id: 'start', type: 'input', position: { x: 50, y: 100 }, data: { label: 'START' } },
      { id: 'end', type: 'output', position: { x: 700, y: 100 }, data: { label: 'END' } },
    ]
  ).map((n: any) => ({
    id: n.id,
    type:
      n.type === 'agent'
        ? 'agent'
        : n.type === 'condition'
          ? 'condition'
          : n.type === 'end'
            ? 'output'
            : 'input',
    position: n.position ?? { x: Math.random() * 400 + 100, y: Math.random() * 250 + 80 },
    data: n,
  }));
  const initialEdges = (value?.edges ?? []).map((e: any) => ({
    ...e,
    animated: true,
    label: e.label,
  }));
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  function emit(ns = nodes, es = edges) {
    onChange({
      nodes: ns.map((n: Node) => ({
        id: n.id,
        type: n.type === 'input' ? 'start' : n.type === 'output' ? 'end' : n.type,
        agent_id: (n.data as any).agent_id,
        condition_expr: (n.data as any).condition_expr,
        position: n.position,
      })),
      edges: es.map((e: any) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    });
  }
  function onConnect(c: Connection) {
    setEdges((eds) => {
      const next = addEdge({ ...c, id: `e-${Date.now()}`, animated: true }, eds);
      emit(nodes, next);
      return next;
    });
  }
  function addAgent(a: Agent) {
    const next = [
      ...nodes,
      {
        id: `node-${Date.now()}`,
        type: 'agent',
        position: { x: 220, y: 160 },
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
        id: `cond-${Date.now()}`,
        type: 'condition',
        position: { x: 420, y: 160 },
        data: { condition_expr: "agent_outputs['agent-id'] contains 'value'" },
      },
    ];
    setNodes(next);
    emit(next, edges);
  }
  return (
    <div className="grid h-[calc(100vh-160px)] grid-cols-[240px_1fr] border border-border bg-white">
      <aside className="overflow-auto border-r p-3">
        <button
          onClick={addCondition}
          className="mb-3 w-full rounded bg-accent px-3 py-2 text-sm text-white"
        >
          Add Condition
        </button>
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => addAgent(a)}
            className="mb-2 w-full rounded border p-2 text-left text-sm hover:bg-slate-50"
          >
            <strong>{a.name}</strong>
            <div className="text-xs text-slate-500">{a.role}</div>
          </button>
        ))}
      </aside>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(c) => {
          onNodesChange(c);
          setTimeout(() => emit(), 0);
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
