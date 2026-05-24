import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Play, Save } from 'lucide-react';
import type { Agent } from '../../api/client';
import { AgentAPI } from '../../api/client';
import { Button } from '../ui/button';
import { Input, Textarea } from '../ui/input';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  system_prompt: z.string().min(1, 'System prompt is required'),
  model: z.string(),
  tools: z.array(z.string()),
  memory_type: z.string(),
  window_size: z.coerce.number().min(1),
  max_tokens_per_run: z.coerce.number().min(1),
  max_cost_usd: z.coerce.number().min(0),
  forbidden_topics: z.string(),
  schedule: z.string().optional(),
  channel: z.string(),
});

const TOOLS = [
  { id: 'web_search', label: 'Web Search' },
  { id: 'http_request', label: 'HTTP Request' },
  { id: 'send_telegram_message', label: 'Send Telegram' },
  { id: 'read_file', label: 'Read File' },
  { id: 'write_file', label: 'Write File' },
  { id: 'python_repl', label: 'Python REPL' },
  { id: 'summarize_text', label: 'Summarize Text' },
  { id: 'delegate_to_agent', label: 'Delegate to Agent' },
  { id: 'request_human_input', label: 'Ask User (Human Input)' },
];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-600">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

export function AgentForm({
  agent,
  onSubmit,
}: {
  agent?: Agent;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [test, setTest] = useState('');
  const [result, setResult] = useState('');
  const [apiError, setApiError] = useState('');

  const defaultValues = (a?: Agent) => ({
    name: a?.name ?? '',
    role: a?.role ?? '',
    system_prompt: a?.system_prompt ?? '',
    model: a?.model ?? 'gemini-2.5-flash',
    tools: a?.tools ?? [],
    memory_type: (a?.memory_config as any)?.type ?? 'none',
    window_size: (a?.memory_config as any)?.window_size ?? 8,
    max_tokens_per_run: (a?.guardrails as any)?.max_tokens_per_run ?? 4000,
    max_cost_usd: (a?.guardrails as any)?.max_cost_usd ?? 1,
    forbidden_topics: ((a?.guardrails as any)?.forbidden_topics ?? []).join(', '),
    schedule: (a?.schedule as any)?.cron_expression ?? '',
    channel: a?.channel ?? '',
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: defaultValues(agent),
  });

  const memoryType = watch('memory_type');

  async function save(v: any) {
    setApiError('');
    try {
      await onSubmit({
        name: v.name,
        role: v.role,
        system_prompt: v.system_prompt,
        model: v.model,
        tools: v.tools,
        memory_enabled: v.memory_type !== 'none',
        memory_config:
          v.memory_type === 'none' ? {} : { type: v.memory_type, window_size: v.window_size },
        guardrails: {
          max_tokens_per_run: v.max_tokens_per_run,
          max_cost_usd: v.max_cost_usd,
          forbidden_topics: v.forbidden_topics
            .split(',')
            .map((x: string) => x.trim())
            .filter(Boolean),
        },
        schedule: v.schedule ? { cron_expression: v.schedule } : null,
        channel: v.channel || null,
        channel_config: {},
      });
    } catch (e: any) {
      setApiError(e?.response?.data?.detail ?? e?.message ?? 'Failed to save agent');
    }
  }

  async function runTest() {
    if (agent?.id && test) {
      setResult('Running…');
      try {
        const r = await AgentAPI.test(agent.id, test);
        setResult(r.output);
      } catch (e: any) {
        setResult(`Error: ${e?.response?.data?.detail ?? e?.message ?? 'Test failed'}`);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} className="grid gap-4">
      {/* Basic Info */}
      <Section title="Basic Info">
        <div>
          <Label required>Name</Label>
          <Input placeholder="e.g. Research Agent" {...register('name')} />
          <FieldError message={errors.name?.message as string} />
        </div>
        <div>
          <Label required>Role</Label>
          <Input placeholder="e.g. Finds source material" {...register('role')} />
          <FieldError message={errors.role?.message as string} />
        </div>
        <div>
          <Label required>System Prompt</Label>
          <Textarea
            rows={5}
            placeholder="Describe what this agent should do…"
            {...register('system_prompt')}
          />
          <FieldError message={errors.system_prompt?.message as string} />
        </div>
      </Section>

      {/* Model */}
      <Section title="Model">
        <div>
          <Label>LLM Model</Label>
          <select className="w-full rounded-md border border-border px-3 py-2 text-sm" {...register('model')}>
            <optgroup label="Gemini (Free tier)">
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b</option>
            </optgroup>
            <optgroup label="OpenAI (Paid)">
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
            </optgroup>
          </select>
        </div>
      </Section>

      {/* Tools */}
      <Section title="Tools">
        <div className="grid grid-cols-2 gap-y-2">
          {TOOLS.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" value={t.id} className="accent-primary" {...register('tools')} />
              {t.label}
            </label>
          ))}
        </div>
      </Section>

      {/* Memory */}
      <Section title="Memory">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Type</Label>
            <select className="w-full rounded-md border border-border px-3 py-2 text-sm" {...register('memory_type')}>
              <option value="none">None</option>
              <option value="buffer">Buffer (last N messages)</option>
              <option value="summary">Summary</option>
            </select>
          </div>
          {memoryType !== 'none' && (
            <div>
              <Label>Window Size</Label>
              <Input type="number" placeholder="8" {...register('window_size')} />
            </div>
          )}
        </div>
      </Section>

      {/* Guardrails */}
      <Section title="Guardrails">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Max Tokens / Run</Label>
            <Input type="number" placeholder="4000" {...register('max_tokens_per_run')} />
          </div>
          <div>
            <Label>Max Cost (USD)</Label>
            <Input type="number" step="0.01" placeholder="1.00" {...register('max_cost_usd')} />
          </div>
        </div>
        <div>
          <Label>Forbidden Topics</Label>
          <Input placeholder="violence, politics (comma separated)" {...register('forbidden_topics')} />
        </div>
      </Section>

      {/* Schedule & Channel */}
      <Section title="Schedule & Channel">
        <div>
          <Label>Cron Schedule</Label>
          <Input placeholder="0 9 * * * (optional)" {...register('schedule')} />
        </div>
        <div>
          <Label>Messaging Channel</Label>
          <select className="w-full rounded-md border border-border px-3 py-2 text-sm" {...register('channel')}>
            <option value="">None</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>
      </Section>

      {apiError && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{apiError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        <Save size={16} />
        {isSubmitting ? 'Saving…' : 'Save Agent'}
      </Button>

      {/* Test panel — only for saved agents */}
      {agent && (
        <Section title="Test This Agent">
          <div>
            <Label>Test Message</Label>
            <Input
              placeholder="Send a message to this agent…"
              value={test}
              onChange={(e) => setTest(e.target.value)}
            />
          </div>
          <Button type="button" onClick={runTest} disabled={!test}>
            <Play size={16} />
            Run Test
          </Button>
          {result && (
            <pre className="whitespace-pre-wrap rounded bg-white p-3 text-xs text-slate-700 border">
              {result}
            </pre>
          )}
        </Section>
      )}
    </form>
  );
}
