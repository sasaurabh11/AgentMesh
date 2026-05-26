import { type LucideIcon, Activity, Bot, Boxes, Plus, TrendingUp, Zap, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAgents } from '../hooks/useAgents';
import { useWorkflows } from '../hooks/useWorkflows';
import { ExecutionAPI } from '../api/client';
import { StatusBadge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

/* ── Stat card ── */
function Stat({ label, value, sub, icon: Icon, gradient, glow }: {
  label: string; value: string | number; sub: string;
  icon: LucideIcon; gradient: string; glow: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 group p-5">
      {/* Corner glow */}
      <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full ${glow} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
          <p className="mt-2 text-4xl font-extrabold text-white tabular-nums leading-none">{value}</p>
          <p className="mt-1.5 text-xs text-muted-light">{sub}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shrink-0`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

/* ── Quick action card ── */
function QuickAction({ to, label, desc, icon: Icon, gradient }: {
  to: string; label: string; desc: string; icon: LucideIcon; gradient: string;
}) {
  return (
    <Link to={to} className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 hover:border-border-light hover:bg-card-hover hover:-translate-y-0.5 transition-all duration-200 shadow-card">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-md`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-muted-light mt-0.5">{desc}</p>
      </div>
      <ArrowUpRight size={14} className="text-muted shrink-0 group-hover:text-primary-light group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
    </Link>
  );
}

export function Dashboard() {
  const agents    = useAgents();
  const workflows = useWorkflows();
  const exQuery   = useQuery({ queryKey: ['executions'], queryFn: ExecutionAPI.list });
  const runs      = exQuery.data ?? [];
  const completed = runs.filter(r => r.status === 'completed').length;
  const success   = runs.length ? Math.round((completed / runs.length) * 100) : 0;

  return (
    <div className="p-8 space-y-8 animate-fade-in">

      {/* ── Page title ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
          <p className="text-sm text-muted-light mt-1">Welcome back — here's what's happening.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/agents"><Button size="sm"><Plus size={13} />New Agent</Button></Link>
          <Link to="/workflows/new"><Button size="sm" variant="secondary"><Plus size={13} />New Workflow</Button></Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Agents"      value={agents.data?.length ?? 0}    sub="Active AI agents"       icon={Bot}        gradient="from-indigo-500 to-violet-600"  glow="bg-indigo-500" />
        <Stat label="Workflows"   value={workflows.data?.length ?? 0} sub="Configured pipelines"   icon={Boxes}      gradient="from-cyan-500 to-indigo-600"    glow="bg-cyan-500" />
        <Stat label="Executions"  value={runs.length}                 sub="Total runs all-time"    icon={Activity}   gradient="from-orange-500 to-red-500"     glow="bg-orange-500" />
        <Stat label="Success Rate"value={`${success}%`}              sub={`${completed} completed`}icon={TrendingUp} gradient="from-emerald-500 to-cyan-600"   glow="bg-emerald-500" />
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Quick Actions</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction to="/agents"        label="Create Agent"    desc="Add a new AI agent"          icon={Bot}      gradient="from-indigo-500 to-violet-600" />
          <QuickAction to="/workflows/new" label="Build Workflow"  desc="Design a multi-agent flow"   icon={Boxes}    gradient="from-cyan-500 to-indigo-600" />
          <QuickAction to="/chat"          label="Start Chatting"  desc="Talk directly to an agent"   icon={Zap}      gradient="from-violet-500 to-pink-600" />
        </div>
      </div>

      {/* ── Recent executions ── */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-white">Recent Executions</h2>
            <p className="text-xs text-muted mt-0.5">{runs.length} total runs</p>
          </div>
          <Link to="/executions">
            <Button size="xs" variant="ghost">View all <ArrowUpRight size={11} /></Button>
          </Link>
        </div>

        {exQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded-xl" />)}
          </div>
        ) : runs.length === 0 ? (
          <div className="py-16 text-center">
            <Activity size={32} className="mx-auto text-muted/30 mb-3" />
            <p className="text-sm text-muted-light">No executions yet.</p>
            <p className="text-xs text-muted mt-1">Run a workflow to see results here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                {['Execution ID','Channel','Status','Cost'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.slice(0,8).map((r,i) => (
                <tr key={r.id} className={`border-b border-border/40 row-hover transition-colors ${i%2===1?'bg-surface/20':''}`}>
                  <td className="px-6 py-3.5">
                    <Link className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors" to={`/executions/${r.id}`}>
                      {r.id.slice(0,8)}…
                    </Link>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="rounded-lg bg-surface border border-border px-2.5 py-1 text-xs text-muted-light">{r.trigger_channel}</span>
                  </td>
                  <td className="px-6 py-3.5"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-3.5 font-mono text-xs text-muted-light">${r.total_cost_usd.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
