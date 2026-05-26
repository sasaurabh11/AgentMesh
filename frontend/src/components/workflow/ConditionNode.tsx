import { Handle, Position } from 'react-flow-renderer';
import { GitBranch } from 'lucide-react';

export function ConditionNode({ data }: any) {
  return (
    <div className="relative" style={{ width: 130, height: 130 }}>
      {/* Rotated diamond */}
      <div className="absolute inset-0 rotate-45 rounded-xl border-2 border-orange-500/50 bg-card hover:border-orange-500/80 transition-all shadow-card" />
      <Handle type="target" position={Position.Top}
        style={{ background:'#f97316', border:'2px solid #1c2c42', width:10, height:10 }} />
      {/* Inner label — counter-rotated */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2">
        <GitBranch size={14} className="text-orange-400" />
        <p className="text-[10px] font-bold text-white">Condition</p>
        <p className="text-[9px] text-muted-light text-center truncate max-w-[80px] leading-tight">
          {data.condition_expr || 'expression'}
        </p>
      </div>
      <Handle id="true" type="source" position={Position.Right}
        style={{ background:'#22c55e', border:'2px solid #1c2c42', width:10, height:10 }} />
      <Handle id="false" type="source" position={Position.Bottom}
        style={{ background:'#ef4444', border:'2px solid #1c2c42', width:10, height:10 }} />
    </div>
  );
}
