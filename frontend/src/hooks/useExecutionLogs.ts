import { useEffect, useState } from 'react';
import type { ExecutionLog } from '../api/client';
export function useExecutionLogs(executionId?: string) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  useEffect(() => {
    if (!executionId) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/executions/${executionId}/logs`);
    ws.onmessage = (e) => setLogs((v) => [...v, JSON.parse(e.data)]);
    return () => ws.close();
  }, [executionId]);
  return logs;
}
