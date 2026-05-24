import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
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
  }));
}

function toFlowEdges(value: any): Edge[] {
  return (value?.edges ?? []).map((e: any) => ({
    ...e,
    id: e.id ?? `${e.source}-${e.target}`,
    animated: true,
    label: e.label,
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
    // Only keep edges where both source and target exist as real nodes
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
      const next = addEdge({ ...c, id: `e-${Date.now()}`, animated: true }, current);
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
    <div className="grid h-[calc(100vh-160px)] grid-cols-[240px_1fr] border border-border bg-white">
      <aside className="overflow-auto border-r p-3">
        <button
          type="button"
          onClick={addCondition}
          className="mb-3 w-full rounded bg-accent px-3 py-2 text-sm text-white"
        >
          Add Condition
        </button>
        {agents.map((a) => (
          <button
            type="button"
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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
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
