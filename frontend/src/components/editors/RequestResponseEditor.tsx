import type { RequestData, ResponseData, ColumnDef } from '../../types';

interface RequestProps {
  data: RequestData;
  onChange: (data: RequestData) => void;
}

export function RequestEditor({ data, onChange }: RequestProps) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
        <input
          value={data.label || ''}
          onChange={e => onChange({ ...data, label: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
        />
      </div>
      <div className="bg-slate-50 rounded-lg p-3">
        <p className="text-xs text-slate-500 font-medium mb-1">Input Schema</p>
        <p className="text-xs text-slate-400">
          The Request node accepts any JSON object as input. All fields become available to downstream nodes via dot-notation paths (e.g. <code className="bg-slate-200 px-1 rounded">customer.credit_score</code>).
        </p>
      </div>
    </div>
  );
}

interface ResponseProps {
  data: ResponseData;
  onChange: (data: ResponseData) => void;
}

export function ResponseEditor({ data, onChange }: ResponseProps) {
  const update = (patch: Partial<ResponseData>) => onChange({ ...data, ...patch });

  const addField = () => {
    update({ outputFields: [...(data.outputFields || []), { field: '', label: '' }] });
  };

  const updateField = (idx: number, col: ColumnDef) => {
    const outputFields = (data.outputFields || []).map((f, i) => i === idx ? col : f);
    update({ outputFields });
  };

  const removeField = (idx: number) => {
    update({ outputFields: data.outputFields.filter((_, i) => i !== idx) });
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
        <input
          value={data.label || ''}
          onChange={e => update({ label: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-600">Output Fields</label>
          <span className="text-xs text-slate-400">Leave empty to return full context</span>
        </div>

        <div className="space-y-2">
          {(data.outputFields || []).map((f, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={f.field}
                onChange={e => updateField(i, { ...f, field: e.target.value })}
                placeholder="result.decision"
                className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded focus:outline-none focus:border-emerald-400"
              />
              <input
                value={f.label}
                onChange={e => updateField(i, { ...f, label: e.target.value })}
                placeholder="label"
                className="w-28 px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-400"
              />
              <button onClick={() => removeField(i)} className="text-slate-300 hover:text-red-500">✕</button>
            </div>
          ))}
        </div>

        <button
          onClick={addField}
          className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
        >
          + Add output field
        </button>
      </div>
    </div>
  );
}
