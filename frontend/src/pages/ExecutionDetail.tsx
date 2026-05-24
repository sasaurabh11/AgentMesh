import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { ExecutionAPI } from '../api/client';
import { useExecutionLogs } from '../hooks/useExecutionLogs';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';
import { LiveLogStream } from '../components/monitoring/LiveLogStream';
import { MessageTimeline } from '../components/monitoring/MessageTimeline';
import { CostTracker } from '../components/monitoring/CostTracker';

export function ExecutionDetail() {
  const { id } = useParams();
  const [userInput, setUserInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const execution = useQuery({
    queryKey: ['execution', id],
    queryFn: () => ExecutionAPI.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ['completed', 'failed', 'cancelled'].includes(status) ? false : 2000;
    },
  });
  const persisted = useQuery({
    queryKey: ['logs', id],
    queryFn: () => ExecutionAPI.logs(id!),
    enabled: !!id,
    // Poll DB logs every 3s while running so waiting_for_input is found even after WS drops
    refetchInterval: (query) => {
      if (!id) return false;
      const logs = query.state.data ?? [];
      const lastType = [...logs].reverse().find(
        (l) => ['waiting_for_input', 'completed', 'error'].includes(l.log_type)
      )?.log_type;
      return lastType && lastType !== 'waiting_for_input' ? false : 3000;
    },
  });
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => ExecutionAPI.messages(id!),
    enabled: !!id,
  });

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(execution.data?.status ?? '');
  const { logs: live, wsError } = useExecutionLogs(!isTerminal ? id : undefined);
  const logs = [...(persisted.data ?? []), ...live];

  // Find if the workflow is currently waiting for user input.
  // It's waiting when the last meaningful log is a waiting_for_input event.
  const lastSignificant = [...logs].reverse().find(
    (l) => ['waiting_for_input', 'agent_start', 'agent_output', 'completed', 'error'].includes(l.log_type)
  );
  const pendingQuestion =
    lastSignificant?.log_type === 'waiting_for_input' ? lastSignificant.content : null;

  async function sendInput() {
    if (!id || !userInput.trim()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await ExecutionAPI.sendInput(id, userInput.trim());
      setUserInput('');
    } catch (e: any) {
      setSubmitError(e?.response?.data?.detail ?? e?.message ?? 'Failed to send input');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {wsError && !isTerminal && <p className="text-sm text-red-500">{wsError}</p>}

      <Card>
        {execution.isLoading ? (
          <p>Loading execution...</p>
        ) : (
          execution.data && (
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <strong className={execution.data.status === 'running' ? 'text-amber-600' : ''}>
                  {pendingQuestion ? 'waiting for input' : execution.data.status}
                </strong>
              </div>
              <div>
                <p className="text-xs text-slate-500">Trigger</p>
                <strong>{execution.data.trigger_channel}</strong>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tokens</p>
                <strong>{execution.data.total_tokens}</strong>
              </div>
              <div>
                <p className="text-xs text-slate-500">Cost</p>
                <strong>${execution.data.total_cost_usd.toFixed(6)}</strong>
              </div>
            </div>
          )
        )}
      </Card>

      {/* Human-input panel — shown whenever the Orchestrator is waiting */}
      {pendingQuestion && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Agent is asking you a question
          </p>
          <p className="mb-3 text-sm font-medium text-slate-800">{pendingQuestion}</p>
          <Textarea
            rows={3}
            placeholder="Type your answer here…"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInput(); }
            }}
          />
          {submitError && <p className="mt-1 text-xs text-red-500">{submitError}</p>}
          <div className="mt-2">
            <Button onClick={sendInput} disabled={!userInput.trim() || submitting}>
              <Send size={14} />
              {submitting ? 'Sending…' : 'Send Answer'}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Messages</h2>
          <MessageTimeline messages={messages.data ?? []} />
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Live Logs</h2>
          <LiveLogStream logs={logs} />
        </section>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Cost Breakdown</h2>
        <CostTracker logs={logs} />
      </Card>
    </div>
  );
}
