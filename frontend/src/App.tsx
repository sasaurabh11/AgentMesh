import { NavLink, Route, Routes } from 'react-router-dom';
import {
  Activity, Bot, Boxes, Home, MessageSquare,
  Settings as SettingsIcon, Sparkles,
} from 'lucide-react';
import { Dashboard }       from './pages/Dashboard';
import { Agents }          from './pages/Agents';
import { Chat }            from './pages/Chat';
import { Workflows }       from './pages/Workflows';
import { WorkflowBuilder } from './pages/WorkflowBuilder';
import { Executions }      from './pages/Executions';
import { ExecutionDetail } from './pages/ExecutionDetail';
import { Settings }        from './pages/Settings';

const NAV = [
  { to: '/',           label: 'Dashboard',  Icon: Home,         end: true  },
  { to: '/agents',     label: 'Agents',     Icon: Bot,          end: false },
  { to: '/chat',       label: 'Chat',       Icon: MessageSquare,end: false },
  { to: '/workflows',  label: 'Workflows',  Icon: Boxes,        end: false },
  { to: '/executions', label: 'Executions', Icon: Activity,     end: false },
  { to: '/settings',   label: 'Settings',   Icon: SettingsIcon, end: false },
] as const;

export default function App() {
  return (
    <div className="flex min-h-screen bg-bg text-foreground">

      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-surface border-r border-border">

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-primary shadow-glow shrink-0">
            <Sparkles size={17} className="text-white" />
            <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-60 blur-md -z-10" />
          </div>
          <div>
            <p className="text-[15px] font-bold gradient-text leading-tight tracking-tight">AgentMesh</p>
            <p className="text-[10px] text-muted leading-tight">AI Orchestration</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70">
            Menu
          </p>
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary-light'
                    : 'text-muted-light hover:text-foreground hover:bg-card'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active left bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary" />
                  )}
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted group-hover:text-muted-light'
                  }`}>
                    <Icon size={16} />
                  </span>
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(79,142,247,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom card */}
        <div className="p-4 border-t border-border">
          <div className="rounded-xl border border-border bg-card/60 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">AgentMesh v1.0</p>
                <p className="text-[10px] text-muted">Made with ❤️ by Saurabh</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────────────────── */}
      <main className="ml-64 flex-1 min-h-screen bg-bg overflow-x-hidden">
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/agents"        element={<Agents />} />
          <Route path="/chat"          element={<Chat />} />
          <Route path="/chat/:agentId" element={<Chat />} />
          <Route path="/workflows"     element={<Workflows />} />
          <Route path="/workflows/new" element={<WorkflowBuilder />} />
          <Route path="/workflows/:id" element={<WorkflowBuilder />} />
          <Route path="/executions"    element={<Executions />} />
          <Route path="/executions/:id"element={<ExecutionDetail />} />
          <Route path="/settings"      element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
