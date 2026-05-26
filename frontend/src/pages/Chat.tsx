import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, ChevronDown, ChevronRight, Send, Sparkles, Trash2, User, Wrench } from 'lucide-react';
import { AgentAPI, type ChatMessage, type ToolStep } from '../api/client';
import { useAgents } from '../hooks/useAgents';
import { Button } from '../components/ui/button';

type Turn = { role: 'user' | 'assistant'; content: string; steps?: ToolStep[] };

function ToolLog({ steps }: { steps: ToolStep[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((s, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface overflow-hidden text-xs">
          <button
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-card-hover transition-colors"
            onClick={() => setOpen(p => ({ ...p, [i]: !p[i] }))}
          >
            <Wrench size={11} className="shrink-0 text-indigo-400" />
            <span className="font-mono font-bold text-indigo-400">{s.tool}</span>
            <span className="ml-1 truncate text-muted-light">{s.input.slice(0, 70)}</span>
            {open[i] ? <ChevronDown size={11} className="ml-auto shrink-0 text-muted" />
                     : <ChevronRight size={11} className="ml-auto shrink-0 text-muted" />}
          </button>
          {open[i] && (
            <div className="border-t border-border px-3.5 py-3 space-y-2.5">
              {[['Input', s.input], ['Output', s.output]].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">{label}</p>
                  <pre className="whitespace-pre-wrap break-all rounded-lg bg-bg border border-border p-2.5 text-xs text-subtle leading-relaxed">{val}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Chat() {
  const { agentId } = useParams<{ agentId: string }>();
  const nav = useNavigate();
  const agents = useAgents();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const agent = agents.data?.find(a => a.id === agentId);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, thinking]);
  useEffect(() => { inputRef.current?.focus(); setTurns([]); setError(''); }, [agentId]);

  const history = (): ChatMessage[] => turns.map(t => ({ role: t.role, content: t.content }));

  async function send() {
    const text = input.trim();
    if (!text || !agentId || thinking) return;
    setInput(''); setError('');
    setTurns(p => [...p, { role: 'user', content: text }]);
    setThinking(true);
    try {
      const res = await AgentAPI.chat(agentId, text, history());
      setTurns(p => [...p, { role: 'assistant', content: res.output, steps: res.steps }]);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Error');
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex h-screen flex-col bg-bg">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-4 border-b border-border bg-surface/80 backdrop-blur px-6 py-3 shrink-0">
        {/* Agent picker */}
        <div className="relative">
          <select
            className="appearance-none h-9 rounded-xl border border-border bg-card pl-3.5 pr-8 text-sm text-foreground font-medium focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 cursor-pointer"
            value={agentId ?? ''}
            onChange={e => nav(`/chat/${e.target.value}`)}
          >
            <option value="" disabled>Select an agent…</option>
            {agents.data?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-muted" />
        </div>

        {agent && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-border">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Bot size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{agent.name}</p>
              <p className="text-[11px] text-muted leading-tight">{agent.model}</p>
            </div>
          </div>
        )}

        {agent && agent.tools.length > 0 && (
          <div className="hidden md:flex flex-wrap gap-1.5 pl-3 border-l border-border">
            {agent.tools.slice(0, 4).map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border px-2 py-0.5 text-[11px] text-muted-light">
                <Wrench size={9} />{t}
              </span>
            ))}
            {agent.tools.length > 4 && <span className="text-[11px] text-muted py-0.5">+{agent.tools.length - 4}</span>}
          </div>
        )}

        {turns.length > 0 && (
          <button
            onClick={() => { setTurns([]); setError(''); }}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors rounded-lg px-2 py-1 hover:bg-red-500/10"
          >
            <Trash2 size={12} />Clear
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {!agentId ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-5 w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">AI Agent Chat</h2>
              <p className="text-muted-light text-sm">Select an agent from the dropdown above to begin.</p>
            </div>
          </div>
        ) : turns.length === 0 && !thinking ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Bot size={26} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">{agent?.name}</h2>
              <p className="text-sm text-muted-light">{agent?.role}</p>
              {agent && agent.tools.length > 0 && (
                <p className="mt-3 text-xs text-muted">{agent.tools.length} tools available</p>
              )}
              <p className="mt-5 text-xs text-muted border-t border-border pt-4">
                Type a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          <>
            {turns.map((t, i) => (
              <div key={i} className={`flex gap-3 ${t.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white ${t.role === 'user' ? 'bg-gradient-primary shadow-glow-sm' : 'bg-card border border-border'}`}>
                  {t.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className="max-w-[78%] space-y-2">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    t.role === 'user'
                      ? 'rounded-tr-sm bg-gradient-primary text-white shadow-glow-sm'
                      : 'rounded-tl-sm bg-card border border-border text-subtle'
                  }`}>
                    {t.content}
                  </div>
                  {t.role === 'assistant' && t.steps && t.steps.length > 0 && <ToolLog steps={t.steps} />}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl shrink-0 bg-card border border-border flex items-center justify-center">
                  <Bot size={14} className="text-muted-light" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
                  <span className="flex gap-1.5 items-center">
                    {[0,150,300].map(d => (
                      <span key={d} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300 text-center">{error}</div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-border bg-surface/80 backdrop-blur px-6 py-4 shrink-0">
        <div className="flex items-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            disabled={!agentId || thinking}
            className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted max-h-40"
            placeholder={agentId ? 'Ask anything… (Enter to send, Shift+Enter for new line)' : 'Select an agent first'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${t.scrollHeight}px`;
            }}
          />
          <Button size="sm" onClick={send} disabled={!input.trim() || !agentId || thinking}>
            <Send size={14} />
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted/50 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
