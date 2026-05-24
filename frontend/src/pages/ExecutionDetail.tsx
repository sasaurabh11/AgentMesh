import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExecutionAPI } from '../api/client';
import { useExecutionLogs } from '../hooks/useExecutionLogs';
import { Card } from '../components/ui/card';
import { LiveLogStream } from '../components/monitoring/LiveLogStream';
import { MessageTimeline } from '../components/monitoring/MessageTimeline';
import { CostTracker } from '../components/monitoring/CostTracker';
export function ExecutionDetail() {
  const { id } = useParams();
  const execution = useQuery({
    queryKey: ['execution', id],
    queryFn: () => ExecutionAPI.get(id!),
    enabled: !!id,
  });
  const persisted = useQuery({
    queryKey: ['logs', id],
    queryFn: () => ExecutionAPI.logs(id!),
    enabled: !!id,
  });
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => ExecutionAPI.messages(id!),
    enabled: !!id,
  });
  const live = useExecutionLogs(id);
  const logs = [...(persisted.data ?? []), ...live];
  return (
    <div className="space-y-4">
      <Card>
        {execution.isLoading ? (
          <p>Loading execution...</p>
        ) : (
          execution.data && (
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <strong>{execution.data.status}</strong>
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
