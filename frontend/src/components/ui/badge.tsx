export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; border: string; dot: string; text: string }> = {
    completed:           { bg:'bg-emerald-500/10', border:'border-emerald-500/30', dot:'bg-emerald-400',          text:'text-emerald-300' },
    running:             { bg:'bg-amber-500/10',   border:'border-amber-500/30',   dot:'bg-amber-400 animate-pulse', text:'text-amber-300' },
    failed:              { bg:'bg-red-500/10',     border:'border-red-500/30',     dot:'bg-red-400',             text:'text-red-300' },
    pending:             { bg:'bg-indigo-500/10',  border:'border-indigo-500/30',  dot:'bg-indigo-400 animate-pulse', text:'text-indigo-300' },
    cancelled:           { bg:'bg-slate-600/20',   border:'border-slate-600/30',   dot:'bg-slate-500',           text:'text-slate-400' },
    'waiting for input': { bg:'bg-amber-500/10',   border:'border-amber-500/30',   dot:'bg-amber-400 animate-pulse', text:'text-amber-300' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
}
