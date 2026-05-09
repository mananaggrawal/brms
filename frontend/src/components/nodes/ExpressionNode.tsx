import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ExpressionData } from '../../types';

export default function ExpressionNode({ data, selected }: NodeProps) {
  const d = data as unknown as ExpressionData;
  const traceStatus = (data as Record<string, unknown>)._traceStatus as string | undefined;
  const traceClass = traceStatus === 'executed' ? 'border-green-500 shadow-lg shadow-green-100'
    : traceStatus === 'no_match' ? 'border-yellow-400 shadow-lg shadow-yellow-100'
    : traceStatus === 'error' ? 'border-red-500 shadow-lg shadow-red-100'
    : traceStatus === 'skipped' ? 'border-slate-300 opacity-60'
    : null;
  return (
    <div className={`bg-white rounded-xl shadow-md border-2 min-w-44 transition-all ${traceClass || (selected ? 'border-violet-500' : 'border-violet-200')}`}>
      <div className="bg-violet-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Expression</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-xs text-slate-700 font-semibold truncate mb-1.5">{d.label || 'Expression'}</div>
        {d.expression && (
          <div className="text-xs text-slate-400 font-mono truncate max-w-36">{d.expression}</div>
        )}
        {d.outputField && (
          <div className="text-xs text-slate-400 mt-0.5">→ {d.outputField}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-violet-400 !border-violet-500" />
      <Handle type="source" position={Position.Right} className="!bg-violet-400 !border-violet-500" />
    </div>
  );
}
