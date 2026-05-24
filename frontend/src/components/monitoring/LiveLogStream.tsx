import type { ExecutionLog } from '../../api/client';
const color: Record<string, string> = {
  agent_start: 'bg-blue-100 text-blue-800',
  tool_call: 'bg-yellow-100 text-yellow-800',
  tool_result: 'bg-green-100 text-green-800',
  agent_output: 'bg-purple-100 text-purple-800',
  error: 'bg-red-100 text-red-800',
  condition_eval: 'bg-slate-100 text-slate-800',
};
export function LiveLogStream({ logs }: { logs: ExecutionLog[] }) {
  return (
    <div className="h-[520px] overflow-auto rounded-md border bg-white p-3 scrollbar">
      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">No live logs yet.</p>
      ) : (
        logs.map((l, i) => (
          <div key={(l.id ?? 'live') + i} className="border-b py-2 text-sm">
            <span className={`rounded px-2 py-1 text-xs ${color[l.log_type] ?? 'bg-slate-100'}`}>
              {l.log_type}
            </span>
            <p className="mt-2 whitespace-pre-wrap">{l.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
