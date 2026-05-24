import type { Message } from '../../api/client';
export function MessageTimeline({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500">No messages persisted yet.</p>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="rounded-md border bg-white p-3">
            <div className="text-xs uppercase text-slate-500">
              {m.direction} · {m.channel}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{m.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
