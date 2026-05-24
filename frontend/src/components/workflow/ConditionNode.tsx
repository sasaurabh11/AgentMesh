import { Handle, Position } from 'react-flow-renderer';

export function ConditionNode({ data }: any) {
  return (
    <div className="rotate-45 border-2 border-accent bg-white p-5 shadow">
      <Handle type="target" position={Position.Top} />
      <div className="-rotate-45 w-32 text-center text-xs">
        <strong>Condition</strong>
        <div className="mt-1 truncate">{data.condition_expr || 'expression'}</div>
      </div>
      <Handle id="true" type="source" position={Position.Right} />
      <Handle id="false" type="source" position={Position.Bottom} />
    </div>
  );
}
