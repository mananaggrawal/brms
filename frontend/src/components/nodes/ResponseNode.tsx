import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ResponseData } from '../../types';

export default function ResponseNode({ data, selected }: NodeProps) {
  const d = data as unknown as ResponseData;
  const traceStatus = (data as Record<string, unknown>)._traceStatus as string | undefined;
  const traceClass = traceStatus === 'executed' ? 'border-green-500 shadow-lg shadow-green-100'
    : traceStatus === 'no_match' ? 'border-yellow-400 shadow-lg shadow-yellow-100'
    : traceStatus === 'error' ? 'border-red-500 shadow-lg shadow-red-100'
    : traceStatus === 'skipped' ? 'border-slate-300 opacity-60'
    : null;
  return (
    <div className={`bg-white rounded-xl shadow-md border-2 min-w-36 transition-all ${traceClass || (selected ? 'border-emerald-500' : 'border-emerald-200')}`}>
      <div className="bg-emerald-600 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Response</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-xs text-slate-600 font-medium mb-1">{d.label || 'Response'}</div>
        {d.outputFields?.length > 0 && (
          <div className="text-xs text-slate-400">{d.outputFields.length} output field{d.outputFields.length !== 1 ? 's' : ''}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-emerald-400 !border-emerald-500" />
    </div>
  );
}
