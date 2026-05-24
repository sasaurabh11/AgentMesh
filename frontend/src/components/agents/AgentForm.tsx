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
  name: z.string().min(1),
  role: z.string().min(1),
  system_prompt: z.string().min(1),
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
const tools = [
  'web_search',
  'http_request',
  'send_telegram_message',
  'read_file',
  'write_file',
  'python_repl',
  'summarize_text',
  'delegate_to_agent',
];
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: agent?.name ?? '',
      role: agent?.role ?? '',
      system_prompt: agent?.system_prompt ?? '',
      model: agent?.model ?? 'gemini-2.5-flash',
      tools: agent?.tools ?? [],
      memory_type: (agent?.memory_config as any)?.type ?? 'none',
      window_size: (agent?.memory_config as any)?.window_size ?? 8,
      max_tokens_per_run: (agent?.guardrails as any)?.max_tokens_per_run ?? 4000,
      max_cost_usd: (agent?.guardrails as any)?.max_cost_usd ?? 1,
      forbidden_topics: ((agent?.guardrails as any)?.forbidden_topics ?? []).join(','),
      schedule: (agent?.schedule as any)?.cron_expression ?? '',
      channel: agent?.channel ?? '',
    },
  });
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
      const r = await AgentAPI.test(agent.id, test);
      setResult(r.output);
    }
  }
  return (
    <form onSubmit={handleSubmit(save)} className="grid gap-3">
      <div>
        <Input placeholder="Name" {...register('name')} />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message as string}</p>}
      </div>
      <div>
        <Input placeholder="Role" {...register('role')} />
        {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role.message as string}</p>}
      </div>
      <div>
        <Textarea rows={5} placeholder="System Prompt" {...register('system_prompt')} />
        {errors.system_prompt && <p className="mt-1 text-xs text-red-500">{errors.system_prompt.message as string}</p>}
      </div>
      <select className="rounded-md border border-border px-3 py-2" {...register('model')}>
        <option value="gemini-2.5-flash">gemini-2.5-flash - Gemini free tier</option>
        <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b - Gemini free tier</option>
        <option value="gemini-2.0-flash">gemini-2.0-flash - Gemini free tier where available</option>
        <option value="gpt-4o">gpt-4o - OpenAI paid</option>
        <option value="gpt-4o-mini">gpt-4o-mini - OpenAI paid</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        {tools.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input type="checkbox" value={t} {...register('tools')} />
            {t}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select className="rounded-md border border-border px-3 py-2" {...register('memory_type')}>
          <option value="none">none</option>
          <option value="buffer">buffer</option>
          <option value="summary">summary</option>
        </select>
        <Input type="number" placeholder="Window size" {...register('window_size')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Max tokens" {...register('max_tokens_per_run')} />
        <Input type="number" step="0.01" placeholder="Max cost USD" {...register('max_cost_usd')} />
      </div>
      <Input placeholder="Forbidden topics, comma separated" {...register('forbidden_topics')} />
      <Input placeholder="Cron expression (optional)" {...register('schedule')} />
      <select className="rounded-md border border-border px-3 py-2" {...register('channel')}>
        <option value="">none</option>
        <option value="telegram">telegram</option>
      </select>
      {apiError && <p className="text-xs text-red-500">{apiError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        <Save size={16} />
        {isSubmitting ? 'Saving…' : 'Save Agent'}
      </Button>
      {agent && (
        <div className="grid gap-2 border-t pt-3">
          <Input
            placeholder="Test message"
            value={test}
            onChange={(e) => setTest(e.target.value)}
          />
          <Button type="button" onClick={runTest}>
            <Play size={16} />
            Test
          </Button>
          {result && (
            <pre className="whitespace-pre-wrap rounded bg-slate-100 p-3 text-sm">{result}</pre>
          )}
        </div>
      )}
    </form>
  );
}
