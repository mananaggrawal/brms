import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RequestData } from '../../types';

export default function RequestNode({ data, selected }: NodeProps) {
  const d = data as unknown as RequestData;
  const traceStatus = (data as Record<string, unknown>)._traceStatus as string | undefined;
  const traceClass = traceStatus === 'executed' ? 'border-green-500 shadow-lg shadow-green-100'
    : traceStatus === 'no_match' ? 'border-yellow-400 shadow-lg shadow-yellow-100'
    : traceStatus === 'error' ? 'border-red-500 shadow-lg shadow-red-100'
    : traceStatus === 'skipped' ? 'border-slate-300 opacity-60'
    : null;
  return (
    <div className={`bg-white rounded-xl shadow-md border-2 min-w-36 transition-all ${traceClass || (selected ? 'border-emerald-500' : 'border-emerald-200')}`}>
      <div className="bg-emerald-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Request</span>
      </div>
      <div className="px-3 py-2.5 text-xs text-slate-600 font-medium">{d.label || 'Request'}</div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-400 !border-emerald-500" />
    </div>
  );
}
