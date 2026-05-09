import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FunctionData } from '../../types';

export default function FunctionNode({ data, selected }: NodeProps) {
  const d = data as unknown as FunctionData;
  const lineCount = d.code?.split('\n').length || 0;
  const traceStatus = (data as Record<string, unknown>)._traceStatus as string | undefined;
  const traceClass = traceStatus === 'executed' ? 'border-green-500 shadow-lg shadow-green-100'
    : traceStatus === 'no_match' ? 'border-yellow-400 shadow-lg shadow-yellow-100'
    : traceStatus === 'error' ? 'border-red-500 shadow-lg shadow-red-100'
    : traceStatus === 'skipped' ? 'border-slate-300 opacity-60'
    : null;
  return (
    <div className={`bg-white rounded-xl shadow-md border-2 min-w-44 transition-all ${traceClass || (selected ? 'border-amber-500' : 'border-amber-200')}`}>
      <div className="bg-amber-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Function</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-xs text-slate-700 font-semibold truncate mb-1.5">{d.label || 'Function'}</div>
        {lineCount > 0 && (
          <div className="text-xs text-slate-400">{lineCount} line{lineCount !== 1 ? 's' : ''}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-amber-400 !border-amber-500" />
      <Handle type="source" position={Position.Right} className="!bg-amber-400 !border-amber-500" />
    </div>
  );
}
