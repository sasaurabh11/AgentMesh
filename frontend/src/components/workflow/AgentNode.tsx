import { Handle, Position } from 'react-flow-renderer';

const GRADIENTS = [
  ['#4f8ef7', '#8b5cf6'],
  ['#06b6d4', '#4f8ef7'],
  ['#8b5cf6', '#ec4899'],
  ['#f97316', '#ef4444'],
  ['#22c55e', '#06b6d4'],
];
const pickGradient = (name = '') => GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];

const truncate = (str = '', max: number) =>
  str.length <= max ? str : str.slice(0, max).trimEnd() + '…';

export function AgentNode({ data }: any) {
  const [c1, c2] = pickGradient(data.name);
  const initials  = (data.name || 'AG').slice(0, 2).toUpperCase();
  const toolCount = Array.isArray(data.tools) ? data.tools.length : 0;
  const desc      = data.system_prompt || data.role || '';

  return (
    <div style={{
      width: 240,
      borderRadius: 14,
      border: `1.5px solid rgba(79,142,247,0.4)`,
      background: '#1c2c42',
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      overflow: 'hidden',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    }}>
      {/* Top colour strip */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />

      <Handle type="target" position={Position.Top}
        style={{ background: '#4f8ef7', border: '2px solid #1c2c42', width: 10, height: 10 }} />

      <div style={{ padding: '12px 14px 4px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {/* Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${c1}33, ${c2}33)`,
            border: `1.5px solid ${c1}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: c1 }}>{initials}</span>
          </div>

          {/* Name + role */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 700, color: '#eaf2ff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {data.name || 'Agent'}
            </p>
            <p style={{
              margin: '2px 0 0', fontSize: 10, color: '#76aaff', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {data.role || ''}
            </p>
          </div>
        </div>

        {/* Description */}
        {desc && (
          <div style={{
            marginBottom: 10,
            padding: '7px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{
              margin: 0, fontSize: 10.5, color: '#ccddf5', lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical' as any,
              overflow: 'hidden',
            }}>
              {truncate(desc, 120)}
            </p>
          </div>
        )}

        {/* Footer row: model + tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <div style={{
            flex: 1, padding: '4px 9px', borderRadius: 7,
            background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)',
            fontSize: 10, fontFamily: 'monospace', color: '#76aaff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {data.model || 'model'}
          </div>

          {toolCount > 0 && (
            <div style={{
              padding: '4px 8px', borderRadius: 7, flexShrink: 0,
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
              fontSize: 10, color: '#c4b5fd', fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {toolCount} tool{toolCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ background: '#4f8ef7', border: '2px solid #1c2c42', width: 10, height: 10 }} />
    </div>
  );
}
