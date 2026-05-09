import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DecisionTableData } from '../../types';

const HIT_POLICY_COLORS: Record<string, string> = {
  first: 'bg-blue-100 text-blue-700',
  all: 'bg-purple-100 text-purple-700',
  collect: 'bg-indigo-100 text-indigo-700',
};

export default function DecisionTableNode({ data, selected }: NodeProps) {
  const d = data as unknown as DecisionTableData;
  const traceStatus = (data as Record<string, unknown>)._traceStatus as string | undefined;
  const traceClass = traceStatus === 'executed' ? 'border-green-500 shadow-lg shadow-green-100'
    : traceStatus === 'no_match' ? 'border-yellow-400 shadow-lg shadow-yellow-100'
    : traceStatus === 'error' ? 'border-red-500 shadow-lg shadow-red-100'
    : traceStatus === 'skipped' ? 'border-slate-300 opacity-60'
    : null;
  return (
    <div className={`bg-white rounded-xl shadow-md border-2 min-w-44 transition-all ${traceClass || (selected ? 'border-blue-500' : 'border-blue-200')}`}>
      <div className="bg-blue-500 rounded-t-[10px] px-3 py-2 flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
        <span className="text-white text-xs font-semibold uppercase tracking-wide flex-1 truncate">Decision Table</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${HIT_POLICY_COLORS[d.hitPolicy] || 'bg-white/20 text-white'}`}>
          {(d.hitPolicy || 'F').charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-xs text-slate-700 font-semibold truncate mb-1.5">{d.label || 'Decision Table'}</div>
        <div className="flex gap-3 text-xs text-slate-400">
          <span>{d.inputs?.length || 0} in</span>
          <span>{d.outputs?.length || 0} out</span>
          <span>{d.rows?.length || 0} rows</span>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !border-blue-500" />
      <Handle type="source" position={Position.Right} className="!bg-blue-400 !border-blue-500" />
    </div>
  );
}
