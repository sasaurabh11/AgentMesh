import { useEffect, useRef, useState } from 'react';
import type { ExecutionLog } from '../api/client';

export function useExecutionLogs(executionId?: string) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [wsError, setWsError] = useState('');
  const closing = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!executionId) return;
    closing.current = false;
    let ws: WebSocket;

    function connect() {
      if (closing.current) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/executions/${executionId}/logs`);

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        // Heartbeat pings keep the connection alive — don't add them to the log list
        if (data.type === 'heartbeat') return;
        setLogs((v) => [...v, data]);
        setWsError('');
      };

      ws.onerror = () => {
        if (!closing.current) setWsError('Live log stream disconnected');
      };

      ws.onclose = (e) => {
        if (closing.current) return;
        if (!e.wasClean) {
          setWsError('Live log stream disconnected');
          // Auto-reconnect after 3 seconds while execution is still running
          retryTimer.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closing.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      ws?.close();
    };
  }, [executionId]);

  return { logs, wsError };
}
