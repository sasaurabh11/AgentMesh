import { Link } from 'react-router-dom';
import { Plus, ScrollText } from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useWorkflows } from '../hooks/useWorkflows';
import { useQuery } from '@tanstack/react-query';
import { ExecutionAPI } from '../api/client';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export function Dashboard() {
  const agents = useAgents();
  const workflows = useWorkflows();
  const executions = useQuery({ queryKey: ['executions'], queryFn: ExecutionAPI.list });
  const runs = executions.data ?? [];
  const success = runs.length
    ? Math.round((runs.filter((r) => r.status === 'completed').length / runs.length) * 100)
    : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Agents</p>
          <strong className="text-3xl">{agents.data?.length ?? 0}</strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Workflows</p>
          <strong className="text-3xl">{workflows.data?.length ?? 0}</strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Executions</p>
          <strong className="text-3xl">{runs.length}</strong>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Success Rate</p>
          <strong className="text-3xl">{success}%</strong>
        </Card>
      </div>
      <div className="flex gap-3">
        <Link to="/agents">
          <Button>
            <Plus size={16} />
            New Agent
          </Button>
        </Link>
        <Link to="/workflows/new">
          <Button>
            <Plus size={16} />
            New Workflow
          </Button>
        </Link>
        <Link to="/executions">
          <Button>
            <ScrollText size={16} />
            View Logs
          </Button>
        </Link>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Recent Executions</h2>
        {executions.isLoading ? (
          <p>Loading executions...</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-slate-500">No executions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">
                    <Link className="text-primary" to={`/executions/${r.id}`}>
                      {r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{r.trigger_channel}</td>
                  <td>{r.status}</td>
                  <td>${r.total_cost_usd.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
