import { useState } from 'react';
import { Globe, type LucideIcon, Key, Lock, MessageCircle, Send, Shield } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

function Section({ title, desc, icon: Icon, color, children }: {
  title: string; desc: string; icon: LucideIcon; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-muted-light">{desc}</p>
        </div>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-subtle">{label}</label>
      {desc && <p className="text-[11px] text-muted">{desc}</p>}
      {children}
    </div>
  );
}

export function Settings() {
  const [url, setUrl] = useState(`${location.origin.replace(':3000', ':8000')}/webhook/telegram`);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  async function register() {
    setStatus(''); setIsError(false);
    try {
      const r = await api.post('/api/settings/telegram/register', null, { params: { webhook_url: url } });
      setStatus(JSON.stringify(r.data, null, 2));
    } catch (e: any) {
      setIsError(true);
      setStatus(e.response?.data?.detail ?? 'Registration failed');
    }
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Settings</h1>
        <p className="text-sm text-muted-light mt-1">Platform integrations and credentials</p>
      </div>

      <Section title="API Keys" desc="Credentials for AI model providers" icon={Key} color="bg-gradient-to-br from-indigo-500 to-violet-600">
        <div className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted-light leading-relaxed">
          Set global keys in backend <code className="bg-card border border-border rounded px-1.5 py-0.5 text-indigo-300 font-mono">.env</code>.
          Per-agent keys are set in the Agent editor and override the global key.
        </div>
        <Field label="OpenAI API Key" desc="Powers GPT-4o and GPT-4o-mini models">
          <Input type="password" placeholder="Set OPENAI_API_KEY in backend/.env" readOnly className="cursor-not-allowed opacity-60" />
        </Field>
        <Field label="Anthropic API Key" desc="Powers Claude Opus, Sonnet, Haiku">
          <Input type="password" placeholder="Set ANTHROPIC_API_KEY in backend/.env" readOnly className="cursor-not-allowed opacity-60" />
        </Field>
        <Field label="Google Gemini API Key" desc="Powers Gemini models (free tier available)">
          <Input type="password" placeholder="Set GEMINI_API_KEY in backend/.env" readOnly className="cursor-not-allowed opacity-60" />
        </Field>
      </Section>

      <Section title="Telegram Integration" desc="Connect your Telegram bot" icon={MessageCircle} color="bg-gradient-to-br from-cyan-500 to-indigo-600">
        <Field label="Bot Token" desc="Obtain from @BotFather on Telegram">
          <Input type="password" placeholder="Set TELEGRAM_BOT_TOKEN in backend/.env" readOnly className="cursor-not-allowed opacity-60" />
        </Field>
        <Field label="Webhook URL" desc="Register this URL with Telegram so it forwards messages to your backend">
          <div className="flex gap-2">
            <Input value={url} onChange={e => setUrl(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={register} className="shrink-0">
              <Globe size={13} />Register
            </Button>
          </div>
        </Field>
        {status && (
          <div className={`rounded-xl border px-4 py-3 ${isError ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
            <pre className={`text-xs whitespace-pre-wrap ${isError ? 'text-red-300' : 'text-emerald-300'}`}>{status}</pre>
          </div>
        )}
      </Section>

      <Section title="Security" desc="Platform security configuration" icon={Shield} color="bg-gradient-to-br from-emerald-500 to-cyan-600">
        {[
          { label: 'Agent API keys',        value: 'Never returned via API',                       ok: true },
          { label: 'Webhook verification',  value: 'TELEGRAM_WEBHOOK_SECRET supported',            ok: true },
          { label: 'CORS policy',           value: 'Configurable via BACKEND_CORS_ORIGINS',        ok: true },
          { label: 'Per-agent key storage', value: 'Encrypted at rest (database-level)',           ok: true },
        ].map(({ label, value, ok }) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-light">{label}</span>
            <span className={`text-xs font-semibold ${ok ? 'text-emerald-400' : 'text-amber-400'} flex items-center gap-1.5`}>
              {ok ? <Lock size={11} /> : <AlertIcon />}
              {value}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function AlertIcon() {
  return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />;
}
