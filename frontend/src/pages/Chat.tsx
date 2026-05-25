import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Bot, User, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { AgentAPI, type ChatMessage, type ToolStep } from '../api/client';
import { useAgents } from '../hooks/useAgents';
import { Button } from '../components/ui/button';

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  steps?: ToolStep[];   // tool calls made during this turn
};

function ToolCallLog({ steps }: { steps: ToolStep[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((s, i) => (
        <div key={i} className="rounded-md border border-slate-200 bg-white text-xs">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
            onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
          >
            <Wrench size={12} className="shrink-0 text-primary" />
            <span className="font-mono font-semibold text-primary">{s.tool}</span>
            <span className="ml-1 truncate text-slate-400">{s.input.slice(0, 80)}</span>
            {expanded[i] ? (
              <ChevronDown size={12} className="ml-auto shrink-0 text-slate-400" />
            ) : (
              <ChevronRight size={12} className="ml-auto shrink-0 text-slate-400" />
            )}
          </button>
          {expanded[i] && (
            <div className="border-t border-slate-100 px-3 py-2 space-y-2">
              <div>
                <p className="mb-0.5 font-semibold text-slate-500">Input</p>
                <pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-slate-700">
                  {s.input}
                </pre>
              </div>
              <div>
                <p className="mb-0.5 font-semibold text-slate-500">Output</p>
                <pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-slate-700">
                  {s.output}
                </pre>
              </div>
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedAgent = agents.data?.find((a) => a.id === agentId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, thinking]);

  useEffect(() => {
    inputRef.current?.focus();
    setTurns([]);
    setError('');
  }, [agentId]);

  // Build the flat ChatMessage[] history the API needs (no tool steps)
  const messageHistory = (): ChatMessage[] =>
    turns.map((t) => ({ role: t.role, content: t.content }));

  async function send() {
    const text = input.trim();
    if (!text || !agentId || thinking) return;

    setInput('');
    setError('');
    setTurns((prev) => [...prev, { role: 'user', content: text }]);
    setThinking(true);

    try {
      const res = await AgentAPI.chat(agentId, text, messageHistory());
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: res.output, steps: res.steps },
      ]);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to get response');
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (agents.isLoading) return <p className="p-6">Loading agents...</p>;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Agent selector */}
      <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
        <div className="relative">
          <select
            className="appearance-none rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            value={agentId ?? ''}
            onChange={(e) => nav(`/chat/${e.target.value}`)}
          >
            <option value="" disabled>Select an agent…</option>
            {agents.data?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2.5 text-slate-400" />
        </div>
        {selectedAgent && (
          <div>
            <p className="text-sm font-semibold">{selectedAgent.name}</p>
            <p className="text-xs text-slate-500">{selectedAgent.role}</p>
          </div>
        )}
        {selectedAgent && selectedAgent.tools.length > 0 && (
          <div className="ml-2 flex flex-wrap gap-1">
            {selectedAgent.tools.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                <Wrench size={10} />
                {t}
              </span>
            ))}
          </div>
        )}
        {turns.length > 0 && (
          <button
            onClick={() => { setTurns([]); setError(''); }}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!agentId ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <div className="text-center">
              <Bot size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select an agent to start chatting</p>
            </div>
          </div>
        ) : turns.length === 0 && !thinking ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <div className="text-center">
              <Bot size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{selectedAgent?.name}</p>
              <p className="mt-1 text-xs">{selectedAgent?.role}</p>
              {selectedAgent && selectedAgent.tools.length > 0 && (
                <p className="mt-3 text-xs">
                  Tools: {selectedAgent.tools.join(', ')}
                </p>
              )}
              <p className="mt-4 text-xs">Type a message below to start the conversation</p>
            </div>
          </div>
        ) : (
          <>
            {turns.map((turn, i) => (
              <div key={i} className={`flex gap-3 ${turn.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${
                    turn.role === 'user' ? 'bg-primary' : 'bg-slate-400'
                  }`}
                >
                  {turn.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className="max-w-[75%] space-y-1">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      turn.role === 'user'
                        ? 'rounded-tr-sm bg-primary text-white'
                        : 'rounded-tl-sm bg-slate-100 text-slate-800'
                    }`}
                  >
                    {turn.content}
                  </div>
                  {/* Tool call log — shown below assistant turns */}
                  {turn.role === 'assistant' && turn.steps && turn.steps.length > 0 && (
                    <ToolCallLog steps={turn.steps} />
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-400 text-white">
                  <Bot size={14} />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <textarea
            ref={inputRef}
            rows={1}
            disabled={!agentId || thinking}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400 max-h-32"
            placeholder={agentId ? 'Ask anything… (Enter to send, Shift+Enter for newline)' : 'Select an agent first'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${t.scrollHeight}px`;
            }}
          />
          <Button
            onClick={send}
            disabled={!input.trim() || !agentId || thinking}
            className="shrink-0 px-2 py-1 h-auto"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
