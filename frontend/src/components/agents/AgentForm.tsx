import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Key, Play, Save } from 'lucide-react';
import type { Agent } from '../../api/client';
import { AgentAPI } from '../../api/client';
import { Button } from '../ui/button';
import { Input, Textarea } from '../ui/input';

const schema = z.object({
  name: z.string().min(1), role: z.string().min(1), system_prompt: z.string().min(1),
  model: z.string(), api_key: z.string().optional(), tools: z.array(z.string()),
  memory_type: z.string(), window_size: z.coerce.number().min(1),
  max_tokens_per_run: z.coerce.number().min(1), max_cost_usd: z.coerce.number().min(0),
  forbidden_topics: z.string(), schedule: z.string().optional(), channel: z.string(),
});

const TOOL_GROUPS = [
  { label: 'Web & Data', tools: [
    { id: 'web_search',    label: 'Web Search',    desc: 'DuckDuckGo / Tavily' },
    { id: 'extract_webpage',label:'Extract Webpage',desc:'Scrape clean text from any URL' },
    { id: 'http_request',  label: 'HTTP Request',  desc: 'Call any REST API' },
    { id: 'rss_reader',    label: 'RSS Reader',    desc: 'Parse RSS / Atom feeds' },
  ]},
  { label: 'AI & Analysis', tools: [
    { id: 'summarize_text',label: 'Summarize Text',desc: 'Condense long text with AI' },
    { id: 'analyze_image', label: 'Analyze Image', desc: 'Describe or question an image' },
  ]},
  { label: 'Files & Code', tools: [
    { id: 'read_file',  label: 'Read File',   desc: 'Read from /workspace' },
    { id: 'write_file', label: 'Write File',  desc: 'Write to /workspace' },
    { id: 'list_files', label: 'List Files',  desc: 'Browse /workspace' },
    { id: 'python_repl',label: 'Python REPL', desc: 'Execute Python safely' },
  ]},
  { label: 'Memory & Notes', tools: [
    { id: 'save_note', label: 'Save Note', desc: 'Persist a note (7 days)' },
    { id: 'get_note',  label: 'Get Note',  desc: 'Retrieve a saved note' },
  ]},
  { label: 'Utilities', tools: [
    { id: 'get_datetime',         label: 'Date/Time',     desc: 'Current date, time, timezone' },
    { id: 'send_email',           label: 'Send Email',    desc: 'SMTP email sending' },
    { id: 'send_telegram_message',label: 'Send Telegram', desc: 'Send a Telegram message' },
  ]},
  { label: 'Workflow', tools: [
    { id: 'delegate_to_agent',   label: 'Delegate',  desc: 'Route task to another agent' },
    { id: 'request_human_input', label: 'Ask User',  desc: 'Pause and ask the user' },
  ]},
];

const PROVIDER: Record<string, { label: string; ph: string; hint: string }> = {
  google:    { label: 'Google API Key',    ph: 'AIza… (Google AI Studio)',  hint: 'Falls back to server GEMINI_API_KEY.' },
  anthropic: { label: 'Anthropic API Key', ph: 'sk-ant-… (Anthropic)',      hint: 'Falls back to server ANTHROPIC_API_KEY.' },
  openai:    { label: 'OpenAI API Key',    ph: 'sk-… (OpenAI Platform)',     hint: 'Falls back to server OPENAI_API_KEY.' },
};

const getProvider = (m: string) =>
  m.startsWith('gemini-') || m.startsWith('gemma-') ? 'google'
  : m.startsWith('claude-') ? 'anthropic' : 'openai';

const selClass = 'w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 cursor-pointer';

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  );
}

function Label({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="block mb-1.5 text-xs font-semibold text-subtle">
      {children}{req && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-400">{msg}</p> : null;
}

export function AgentForm({ agent, onSubmit }: { agent?: Agent; onSubmit: (d: any) => Promise<void> }) {
  const [test, setTest] = useState('');
  const [result, setResult] = useState('');
  const [apiError, setApiError] = useState('');

  const dv = (a?: Agent) => ({
    name: a?.name ?? '', role: a?.role ?? '', system_prompt: a?.system_prompt ?? '',
    model: a?.model ?? 'gemini-2.5-flash', api_key: '',
    tools: a?.tools ?? [],
    memory_type: (a?.memory_config as any)?.type ?? 'none',
    window_size: (a?.memory_config as any)?.window_size ?? 8,
    max_tokens_per_run: (a?.guardrails as any)?.max_tokens_per_run ?? 4000,
    max_cost_usd: (a?.guardrails as any)?.max_cost_usd ?? 1,
    forbidden_topics: ((a?.guardrails as any)?.forbidden_topics ?? []).join(', '),
    schedule: (a?.schedule as any)?.cron_expression ?? '',
    channel: a?.channel ?? '',
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), mode: 'onSubmit', defaultValues: dv(agent),
  });

  const mem = watch('memory_type');
  const prov = PROVIDER[getProvider(watch('model'))];

  async function save(v: any) {
    setApiError('');
    try {
      const p: any = {
        name: v.name, role: v.role, system_prompt: v.system_prompt, model: v.model, tools: v.tools,
        memory_enabled: v.memory_type !== 'none',
        memory_config: v.memory_type === 'none' ? {} : { type: v.memory_type, window_size: v.window_size },
        guardrails: { max_tokens_per_run: v.max_tokens_per_run, max_cost_usd: v.max_cost_usd,
          forbidden_topics: v.forbidden_topics.split(',').map((x: string) => x.trim()).filter(Boolean) },
        schedule: v.schedule ? { cron_expression: v.schedule } : null,
        channel: v.channel || null, channel_config: {},
      };
      if (v.api_key?.trim()) p.api_key = v.api_key.trim();
      await onSubmit(p);
    } catch (e: any) {
      setApiError(e?.response?.data?.detail ?? e?.message ?? 'Failed to save');
    }
  }

  async function runTest() {
    if (!agent?.id || !test) return;
    setResult('Running…');
    try { const r = await AgentAPI.test(agent.id, test); setResult(r.output); }
    catch (e: any) { setResult(`Error: ${e?.response?.data?.detail ?? e?.message}`); }
  }

  return (
    <form onSubmit={handleSubmit(save)} className="space-y-4">

      <Sec title="Basic Info">
        <div>
          <Label req>Name</Label>
          <Input placeholder="e.g. Research Agent" {...register('name')} />
          <Err msg={errors.name?.message as string} />
        </div>
        <div>
          <Label req>Role</Label>
          <Input placeholder="e.g. Finds source material online" {...register('role')} />
          <Err msg={errors.role?.message as string} />
        </div>
        <div>
          <Label req>System Prompt</Label>
          <Textarea rows={5} placeholder="Describe what this agent should do…" {...register('system_prompt')} />
          <Err msg={errors.system_prompt?.message as string} />
        </div>
      </Sec>

      <Sec title="Model & API Key">
        <div>
          <Label>LLM Model</Label>
          <select className={selClass} {...register('model')}>
            <optgroup label="Gemini (Free tier)">
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b</option>
            </optgroup>
            <optgroup label="Gemma (Free tier)">
              <option value="gemma-4-31b-it">gemma-4-31b-it</option>
            </optgroup>
            <optgroup label="OpenAI (Paid)">
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
            </optgroup>
            <optgroup label="Anthropic Claude (Paid)">
              <option value="claude-opus-4-7">claude-opus-4-7</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
              <option value="claude-haiku-4-5">claude-haiku-4-5</option>
            </optgroup>
          </select>
        </div>
        <div>
          <Label><span className="flex items-center gap-1"><Key size={11} className="text-muted" />{prov.label}</span></Label>
          {agent?.has_api_key && (
            <p className="mb-1.5 flex items-center gap-1.5 text-xs text-emerald-400"><Key size={10} />Key saved — enter new value to replace.</p>
          )}
          <Input type="password" placeholder={agent?.has_api_key ? '••••••••••••' : prov.ph} autoComplete="off" {...register('api_key')} />
          <p className="mt-1 text-[11px] text-muted">{prov.hint}</p>
        </div>
      </Sec>

      <Sec title="Tools">
        {TOOL_GROUPS.map(g => (
          <div key={g.label} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{g.label}</p>
            {g.tools.map(t => (
              <label key={t.id} title={t.desc} className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-xs cursor-pointer hover:bg-card border border-transparent hover:border-border transition-all">
                <input type="checkbox" value={t.id} className="mt-0.5 accent-indigo-500 shrink-0" {...register('tools')} />
                <span>
                  <span className="font-semibold text-subtle">{t.label}</span>
                  <span className="ml-1.5 text-muted">— {t.desc}</span>
                </span>
              </label>
            ))}
          </div>
        ))}
      </Sec>

      <Sec title="Memory">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <select className={selClass} {...register('memory_type')}>
              <option value="none">None</option>
              <option value="buffer">Buffer (last N messages)</option>
              <option value="summary">Summary</option>
            </select>
          </div>
          {mem !== 'none' && (
            <div><Label>Window Size</Label><Input type="number" placeholder="8" {...register('window_size')} /></div>
          )}
        </div>
      </Sec>

      <Sec title="Guardrails">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Max Tokens/Run</Label><Input type="number" placeholder="4000" {...register('max_tokens_per_run')} /></div>
          <div><Label>Max Cost USD</Label><Input type="number" step="0.01" placeholder="1.00" {...register('max_cost_usd')} /></div>
        </div>
        <div>
          <Label>Forbidden Topics</Label>
          <Input placeholder="violence, politics (comma-separated)" {...register('forbidden_topics')} />
        </div>
      </Sec>

      <Sec title="Schedule & Channel">
        <div><Label>Cron Schedule</Label><Input placeholder="0 9 * * * (optional)" {...register('schedule')} /></div>
        <div>
          <Label>Messaging Channel</Label>
          <select className={selClass} {...register('channel')}>
            <option value="">None</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>
      </Sec>

      {apiError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{apiError}</div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        <Save size={14} />{isSubmitting ? 'Saving…' : 'Save Agent'}
      </Button>

      {agent && (
        <Sec title="Test Agent">
          <Input placeholder="Send a test message…" value={test} onChange={e => setTest(e.target.value)} />
          <Button type="button" variant="secondary" size="sm" onClick={runTest} disabled={!test} className="w-full">
            <Play size={13} />Run Test
          </Button>
          {result && (
            <pre className="whitespace-pre-wrap rounded-xl bg-bg border border-border p-3.5 text-xs text-subtle leading-relaxed">{result}</pre>
          )}
        </Sec>
      )}
    </form>
  );
}
