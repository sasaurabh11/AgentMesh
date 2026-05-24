import { NavLink, Route, Routes } from 'react-router-dom';
import { Activity, Bot, Boxes, Home, Settings as SettingsIcon } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { WorkflowBuilder } from './pages/WorkflowBuilder';
import { Executions } from './pages/Executions';
import { ExecutionDetail } from './pages/ExecutionDetail';
import { Settings } from './pages/Settings';
const nav = [
  ['/', 'Dashboard', Home],
  ['/agents', 'Agents', Bot],
  ['/workflows/new', 'Workflows', Boxes],
  ['/executions', 'Executions', Activity],
  ['/settings', 'Settings', SettingsIcon],
] as const;
export default function App() {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-60 border-r bg-white p-4">
        <h1 className="mb-6 text-xl font-bold text-primary">AgentMesh</h1>
        <nav className="grid gap-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-[#e6f4f8] text-primary' : 'hover:bg-slate-100'}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="ml-60 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/workflows/new" element={<WorkflowBuilder />} />
          <Route path="/workflows/:id" element={<WorkflowBuilder />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/executions/:id" element={<ExecutionDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
