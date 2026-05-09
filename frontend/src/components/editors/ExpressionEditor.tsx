import type { ExpressionData } from '../../types';

interface Props {
  data: ExpressionData;
  onChange: (data: ExpressionData) => void;
}

export default function ExpressionEditor({ data, onChange }: Props) {
  const update = (patch: Partial<ExpressionData>) => onChange({ ...data, ...patch });

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
        <input
          value={data.label || ''}
          onChange={e => update({ label: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Expression <span className="text-slate-400 font-normal">(JavaScript boolean)</span>
        </label>
        <textarea
          value={data.expression || ''}
          onChange={e => update({ expression: e.target.value })}
          placeholder="e.g. input.customer.credit_score >= 700 && input.customer.age >= 21"
          rows={3}
          className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400 resize-none"
        />
        <p className="text-xs text-slate-400 mt-1">Use <code className="bg-slate-100 px-1 rounded">input.field.path</code> to reference context values</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Output Field</label>
          <input
            value={data.outputField || ''}
            onChange={e => update({ outputField: e.target.value })}
            placeholder="result.is_eligible"
            className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400"
          />
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">If True →</label>
            <input
              value={data.trueValue || ''}
              onChange={e => update({ trueValue: e.target.value })}
              placeholder='"approved"'
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">If False →</label>
            <input
              value={data.falseValue || ''}
              onChange={e => update({ falseValue: e.target.value })}
              placeholder='"rejected"'
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
