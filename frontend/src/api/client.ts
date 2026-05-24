import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' });

export type Agent = {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  model: string;
  tools: string[];
  memory_enabled: boolean;
  memory_config: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  schedule: Record<string, unknown> | null;
  channel: string | null;
  channel_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  graph_definition: { nodes: any[]; edges: any[]; conditions?: any[] };
  is_template: boolean;
  created_at: string;
  updated_at: string;
};

export type Execution = {
  id: string;
  workflow_id: string;
  trigger_channel: string;
  trigger_input: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  total_tokens: number;
  total_cost_usd: number;
};

export type ExecutionLog = {
  id: string;
  execution_id: string;
  agent_id: string | null;
  log_type: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Message = {
  id: string;
  execution_id: string;
  channel: string;
  direction: string;
  content: string;
  telegram_chat_id: string | null;
  created_at: string;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const AgentAPI = {
  list: () => api.get<Agent[]>('/api/agents').then((r) => r.data),
  create: (d: Partial<Agent>) => api.post<Agent>('/api/agents', d).then((r) => r.data),
  update: (id: string, d: Partial<Agent>) =>
    api.put<Agent>(`/api/agents/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/agents/${id}`),
  test: (id: string, input: string) =>
    api.post(`/api/agents/${id}/test`, { input }).then((r) => r.data),
  chat: (id: string, input: string, messages: ChatMessage[]) =>
    api
      .post<{ output: string; tokens: number; cost_usd: number }>(
        `/api/agents/${id}/test`,
        { input, messages }
      )
      .then((r) => r.data),
  createOrchestrator: () => api.post<Agent>('/api/agents/orchestrator').then((r) => r.data),
};

export const WorkflowAPI = {
  list: () => api.get<Workflow[]>('/api/workflows').then((r) => r.data),
  templates: () => api.get<Workflow[]>('/api/workflows/templates').then((r) => r.data),
  get: (id: string) => api.get<Workflow>(`/api/workflows/${id}`).then((r) => r.data),
  create: (d: Partial<Workflow>) => api.post<Workflow>('/api/workflows', d).then((r) => r.data),
  update: (id: string, d: Partial<Workflow>) =>
    api.put<Workflow>(`/api/workflows/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/workflows/${id}`),
  execute: (id: string, input: string) =>
    api.post(`/api/workflows/${id}/execute`, { input }).then((r) => r.data),
};

export const ExecutionAPI = {
  list: () => api.get<Execution[]>('/api/executions').then((r) => r.data),
  get: (id: string) => api.get<Execution>(`/api/executions/${id}`).then((r) => r.data),
  logs: (id: string) => api.get<ExecutionLog[]>(`/api/executions/${id}/logs`).then((r) => r.data),
  messages: (id: string) =>
    api.get<Message[]>(`/api/executions/${id}/messages`).then((r) => r.data),
  sendInput: (id: string, input: string) =>
    api.post(`/api/executions/${id}/input`, { input }).then((r) => r.data),
};
