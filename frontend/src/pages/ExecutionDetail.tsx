import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, Clock, DollarSign, MessageCircle, Send, Zap } from 'lucide-react';
import { ExecutionAPI } from '../api/client';
import { useExecutionLogs } from '../hooks/useExecutionLogs';
import { StatusBadge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';
import { LiveLogStream }    from '../components/monitoring/LiveLogStream';
import { MessageTimeline }  from '../components/monitoring/MessageTimeline';
import { CostTracker }      from '../components/monitoring/CostTracker';

export function ExecutionDetail() {
  const { id } = useParams();
  const [userInput, setUserInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const execution = useQuery({
    queryKey: ['execution', id],
    queryFn: () => ExecutionAPI.get(id!),
    enabled: !!id,
    refetchInterval: q => {
      const s = q.state.data?.status;
      return s && ['completed','failed','cancelled'].includes(s) ? false : 2000;
    },
  });
  const persisted = useQuery({
    queryKey: ['logs', id],
    queryFn: () => ExecutionAPI.logs(id!),
    enabled: !!id,
    refetchInterval: q => {
      if (!id) return false;
      const last = [...(q.state.data ?? [])].reverse().find(
        l => ['waiting_for_input','completed','error'].includes(l.log_type)
      )?.log_type;
      return last && last !== 'waiting_for_input' ? false : 3000;
    },
  });
  const messages = useQuery({ queryKey: ['messages', id], queryFn: () => ExecutionAPI.messages(id!), enabled: !!id });

  const isTerminal = ['completed','failed','cancelled'].includes(execution.data?.status ?? '');
  const { logs: live, wsError } = useExecutionLogs(!isTerminal ? id : undefined);
  const logs = [...(persisted.data ?? []), ...live];

  const lastSig = [...logs].reverse().find(
    l => ['waiting_for_input','agent_start','agent_output','completed','error'].includes(l.log_type)
  );
  const pending = lastSig?.log_type === 'waiting_for_input' ? lastSig.content : null;

  async function sendInput() {
    if (!id || !userInput.trim()) return;
    setSubmitError(''); setSubmitting(true);
    try { await ExecutionAPI.sendInput(id, userInput.trim()); setUserInput(''); }
    catch (e: any) { setSubmitError(e?.response?.data?.detail ?? e?.message ?? 'Failed'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">

      <div>
        <h1 className="text-2xl font-extrabold text-white">Execution Detail</h1>
        <p className="font-mono text-xs text-muted mt-1">{id}</p>
      </div>

      {wsError && !isTerminal && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={14} />{wsError}
        </div>
      )}

      {/* Stats */}
      {execution.isLoading ? (
        <div className="h-28 rounded-2xl skeleton" />
      ) : execution.data && (
        <div className="rounded-2xl border border-border bg-card shadow-card p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Status',   value: <StatusBadge status={pending ? 'waiting for input' : execution.data.status} />, icon: null },
              { label: 'Trigger',  value: execution.data.trigger_channel, icon: <Zap size={12} /> },
              { label: 'Tokens',   value: execution.data.total_tokens.toLocaleString(), icon: <Activity size={12} /> },
              { label: 'Cost',     value: `$${execution.data.total_cost_usd.toFixed(6)}`, icon: <DollarSign size={12} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted flex items-center gap-1">
                  {icon}{label}
                </p>
                <div className="text-sm font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
          {execution.data.started_at && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-xs text-muted">
              <Clock size={11} />Started {new Date(execution.data.started_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Human-in-loop */}
      {pending && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <MessageCircle size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300">Agent needs your input</p>
              <p className="text-xs text-muted-light">Reply below to continue the workflow</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-white">{pending}</p>
          </div>
          <Textarea rows={3} placeholder="Type your answer…" value={userInput} onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInput(); } }} />
          {submitError && <p className="text-xs text-red-300">{submitError}</p>}
          <Button size="sm" onClick={sendInput} disabled={!userInput.trim() || submitting}>
            <Send size={13} />{submitting ? 'Sending…' : 'Send Answer'}
          </Button>
        </div>
      )}

      {/* Logs + Messages */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageCircle size={14} className="text-indigo-400" />Messages
          </h2>
          <MessageTimeline messages={messages.data ?? []} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={14} className="text-indigo-400" />Live Logs
          </h2>
          <LiveLogStream logs={logs} />
        </div>
      </div>

      {/* Cost */}
      <div className="rounded-2xl border border-border bg-card shadow-card p-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <DollarSign size={14} className="text-indigo-400" />Cost Breakdown
        </h2>
        <CostTracker logs={logs} />
      </div>
    </div>
  );
}
