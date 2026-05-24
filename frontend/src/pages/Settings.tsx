import { useState } from 'react';
import { api } from '../api/client';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
export function Settings() {
  const [url, setUrl] = useState(`${location.origin.replace(':3000', ':8000')}/webhook/telegram`);
  const [status, setStatus] = useState('');
  async function register() {
    try {
      const r = await api.post('/api/settings/telegram/register', null, {
        params: { webhook_url: url },
      });
      setStatus(JSON.stringify(r.data));
    } catch (e: any) {
      setStatus(e.response?.data?.detail ?? 'registration failed');
    }
  }
  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h1 className="mb-3 text-2xl font-semibold">Settings</h1>
        <label className="text-sm font-medium">OpenAI API Key</label>
        <Input type="password" placeholder="Set OPENAI_API_KEY in .env" readOnly />
        <label className="mt-4 block text-sm font-medium">Telegram Bot Token</label>
        <Input type="password" placeholder="Set TELEGRAM_BOT_TOKEN in .env" readOnly />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Telegram Webhook</h2>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button className="mt-3" onClick={register}>
          Register Webhook
        </Button>
        {status && <pre className="mt-3 rounded bg-slate-100 p-3 text-sm">{status}</pre>}
      </Card>
    </div>
  );
}
