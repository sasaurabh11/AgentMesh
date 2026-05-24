import { useEffect, useState } from 'react';
import type { ExecutionLog } from '../api/client';

export function useExecutionLogs(executionId?: string) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [wsError, setWsError] = useState('');

  useEffect(() => {
    if (!executionId) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/executions/${executionId}/logs`);

    ws.onmessage = (e) => setLogs((v) => [...v, JSON.parse(e.data)]);
    ws.onerror = () => setWsError('Live log stream disconnected');
    ws.onclose = (e) => { if (!e.wasClean) setWsError('Live log stream disconnected'); };
    
    return () => ws.close();
  }, [executionId]);

  return { logs, wsError };
}
