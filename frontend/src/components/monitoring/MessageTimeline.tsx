import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { Message } from '../../api/client';

export function MessageTimeline({ messages }: { messages: Message[] }) {
  if (!messages.length) return (
    <div className="rounded-2xl border border-border bg-surface/50 py-10 text-center">
      <p className="text-sm text-muted">No messages yet.</p>
    </div>
  );
  return (
    <div className="space-y-2.5">
      {messages.map(m => {
        const out = m.direction === 'outbound';
        return (
          <div key={m.id} className={`rounded-2xl border p-4 space-y-2 ${out ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${out ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-surface text-muted-light border border-border'}`}>
                {out ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}{m.direction}
              </span>
              <span className="rounded-lg bg-surface border border-border px-2 py-0.5 text-[11px] text-muted">{m.channel}</span>
            </div>
            <p className="text-sm text-subtle whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        );
      })}
    </div>
  );
}
