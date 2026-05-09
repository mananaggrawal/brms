import type { SwitchData } from '../../types';

interface Props {
  data: SwitchData;
  onChange: (data: SwitchData) => void;
}

export default function SwitchEditor({ data, onChange }: Props) {
  return (
    <div className="p-4 space-y-4">
      <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs text-violet-700">
        Edit branches and expressions directly on the node in the graph canvas. Each branch has an output handle you can connect to downstream nodes.
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
        <input
          value={data.label || ''}
          onChange={e => onChange({ ...data, label: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Hit Policy</label>
        <select
          value={data.hitPolicy || 'first'}
          onChange={e => onChange({ ...data, hitPolicy: e.target.value as 'first' | 'collect' })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400 bg-white"
        >
          <option value="first">First — follow only the first matching branch</option>
          <option value="collect">Collect — follow all matching branches</option>
        </select>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-600 mb-2">Branches ({data.branches?.length ?? 0})</div>
        <div className="space-y-1.5">
          {(data.branches || []).map((b, i) => (
            <div key={b.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className={`font-semibold w-12 ${b.isElse ? 'text-slate-400' : 'text-violet-600'}`}>{b.label}</span>
              <span className={`flex-1 font-mono truncate ${b.expression ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                {b.isElse ? 'fallback' : (b.expression || 'empty — always matches')}
              </span>
              <span className="text-slate-300 text-xs">→ {b.port.slice(0, 6)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Expressions use the full context as <code className="bg-slate-100 px-1 rounded">input</code>. Example: <code className="bg-slate-100 px-1 rounded">input.result.decision === "approve"</code></p>
      </div>
    </div>
  );
}
