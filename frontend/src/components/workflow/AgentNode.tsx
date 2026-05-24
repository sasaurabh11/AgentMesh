import { Handle, Position } from 'react-flow-renderer';

export function AgentNode({ data }: any) {
  return (
    <div className="min-w-[180px] rounded-md border-2 border-primary bg-white p-3 shadow">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded bg-primary text-xs font-bold text-white">
          {(data.name || 'A').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{data.name}</div>
          <div className="text-xs text-slate-500">{data.role}</div>
        </div>
      </div>
      <div className="mt-2 rounded bg-slate-100 px-2 py-1 text-xs">{data.model}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
