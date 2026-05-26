import { Handle, Position } from 'react-flow-renderer';
import { Bot } from 'lucide-react';

export function AgentNode({ data }: any) {
  return (
    <div className="min-w-[190px] rounded-2xl border-2 border-primary/40 bg-card shadow-card overflow-hidden hover:border-primary/70 transition-all">
      <div className="h-0.5 w-full bg-gradient-to-r from-primary to-violet-500" />
      <Handle type="target" position={Position.Top}
        style={{ background:'#4f8ef7', border:'2px solid #1c2c42', width:10, height:10 }} />
      <div className="p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-violet-600/30 border border-primary/30 flex items-center justify-center shrink-0">
            <Bot size={14} className="text-primary-light" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{data.name}</p>
            <p className="text-[10px] text-muted-light truncate">{data.role}</p>
          </div>
        </div>
        <div className="mt-2.5 rounded-lg bg-surface border border-border px-2.5 py-1 text-[10px] text-muted font-mono truncate">
          {data.model}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom}
        style={{ background:'#4f8ef7', border:'2px solid #1c2c42', width:10, height:10 }} />
    </div>
  );
}
