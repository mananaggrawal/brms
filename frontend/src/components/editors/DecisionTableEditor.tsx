import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { DecisionTableData, DecisionRow, ColumnDef, HitPolicy } from '../../types';

interface Props {
  data: DecisionTableData;
  onChange: (data: DecisionTableData) => void;
}

const EXPR_PLACEHOLDER = 'e.g. >= 750  or  false  or  "accept"';

export default function DecisionTableEditor({ data, onChange }: Props) {
  const [editingCol, setEditingCol] = useState<{ type: 'input' | 'output'; index: number } | null>(null);

  const update = (patch: Partial<DecisionTableData>) => onChange({ ...data, ...patch });

  // ── Column management ────────────────────────────────────────
  const addInputCol = () => {
    const inputs = [...(data.inputs || []), { field: 'input.field', label: 'Input' }];
    const rows = (data.rows || []).map(r => ({ ...r, conditions: [...(r.conditions || []), { expression: '' }] }));
    update({ inputs, rows });
  };

  const addOutputCol = () => {
    const outputs = [...(data.outputs || []), { field: 'output.field', label: 'Output' }];
    const rows = (data.rows || []).map(r => ({ ...r, outputs: [...(r.outputs || []), { value: '' }] }));
    update({ outputs, rows });
  };

  const removeInputCol = (idx: number) => {
    update({
      inputs: data.inputs.filter((_, i) => i !== idx),
      rows: data.rows.map(r => ({ ...r, conditions: r.conditions.filter((_, i) => i !== idx) })),
    });
  };

  const removeOutputCol = (idx: number) => {
    update({
      outputs: data.outputs.filter((_, i) => i !== idx),
      rows: data.rows.map(r => ({ ...r, outputs: r.outputs.filter((_, i) => i !== idx) })),
    });
  };

  const updateCol = (type: 'input' | 'output', idx: number, col: ColumnDef) => {
    if (type === 'input') update({ inputs: data.inputs.map((c, i) => i === idx ? col : c) });
    else update({ outputs: data.outputs.map((c, i) => i === idx ? col : c) });
  };

  // ── Row management ───────────────────────────────────────────
  const addRow = () => {
    const row: DecisionRow = {
      id: uuidv4(),
      conditions: data.inputs.map(() => ({ expression: '' })),
      outputs: data.outputs.map(() => ({ value: '' })),
      annotation: '',
    };
    update({ rows: [...(data.rows || []), row] });
  };

  const removeRow = (id: string) => update({ rows: data.rows.filter(r => r.id !== id) });

  const updateConditionExpr = (rowId: string, colIdx: number, expression: string) => {
    update({
      rows: data.rows.map(r => {
        if (r.id !== rowId) return r;
        const conditions = [...(r.conditions || [])];
        conditions[colIdx] = { expression };
        return { ...r, conditions };
      }),
    });
  };

  const updateOutput = (rowId: string, colIdx: number, value: string) => {
    update({
      rows: data.rows.map(r => {
        if (r.id !== rowId) return r;
        const outputs = [...(r.outputs || [])];
        outputs[colIdx] = { value };
        return { ...r, outputs };
      }),
    });
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    const rows = [...data.rows];
    const t = idx + dir;
    if (t < 0 || t >= rows.length) return;
    [rows[idx], rows[t]] = [rows[t], rows[idx]];
    update({ rows });
  };

  // Helper to get the current expression string for a condition cell
  // (handles both new `expression` format and legacy `operator+value`)
  const getConditionExpr = (cond: DecisionRow['conditions'][number]): string => {
    if (!cond) return '';
    if ('expression' in cond && cond.expression !== undefined) return cond.expression;
    // Legacy: rebuild expression from operator+value
    if (cond.operator && cond.value !== undefined) return `${cond.operator} ${cond.value}`.trim();
    return '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Settings bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Label</label>
          <input
            value={data.label || ''}
            onChange={e => update({ label: e.target.value })}
            className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-400 w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Hit Policy</label>
          <select
            value={data.hitPolicy || 'first'}
            onChange={e => update({ hitPolicy: e.target.value as HitPolicy })}
            className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-400 bg-white"
          >
            <option value="first">First — stop on first match</option>
            <option value="all">All — collect all matches</option>
            <option value="collect">Collect — collect outputs</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-slate-400">
          Conditions: type <code className="bg-slate-200 px-1 rounded">&gt;= 750</code> · <code className="bg-slate-200 px-1 rounded">false</code> · <code className="bg-slate-200 px-1 rounded">"accept"</code> · empty = any
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 sticky top-0 z-10">
              <th className="w-8 border-b border-r border-slate-200 px-2 py-2 text-slate-400 font-medium">#</th>

              {/* Input header group */}
              {(data.inputs || []).map((col, ci) => (
                <th key={ci} className="border-b border-r border-slate-200 px-2 py-1 bg-blue-50 min-w-48">
                  <div className="flex items-center gap-1">
                    <div
                      className="flex-1 cursor-pointer text-left"
                      onClick={() => setEditingCol(editingCol?.type === 'input' && editingCol.index === ci ? null : { type: 'input', index: ci })}
                    >
                      {editingCol?.type === 'input' && editingCol.index === ci ? (
                        <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={col.field}
                            onChange={e => updateCol('input', ci, { ...col, field: e.target.value })}
                            placeholder="field.path"
                            className="w-full px-1.5 py-1 border border-blue-300 rounded text-xs font-mono focus:outline-none"
                          />
                          <input
                            value={col.label}
                            onChange={e => updateCol('input', ci, { ...col, label: e.target.value })}
                            placeholder="Label"
                            className="w-full px-1.5 py-1 border border-blue-300 rounded text-xs focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-700 text-xs">{col.label || 'Input'}</div>
                          <div className="text-slate-400 font-mono text-xs truncate">{col.field}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeInputCol(ci)} className="text-slate-300 hover:text-red-400 flex-shrink-0" title="Remove">✕</button>
                  </div>
                </th>
              ))}
              <th className="border-b border-r border-slate-200 px-1 py-1 bg-blue-50 w-8">
                <button onClick={addInputCol} className="w-5 h-5 rounded bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center font-bold mx-auto" title="Add input">+</button>
              </th>

              {/* Output header group */}
              {(data.outputs || []).map((col, ci) => (
                <th key={ci} className="border-b border-r border-slate-200 px-2 py-1 bg-green-50 min-w-36">
                  <div className="flex items-center gap-1">
                    <div
                      className="flex-1 cursor-pointer text-left"
                      onClick={() => setEditingCol(editingCol?.type === 'output' && editingCol.index === ci ? null : { type: 'output', index: ci })}
                    >
                      {editingCol?.type === 'output' && editingCol.index === ci ? (
                        <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={col.field}
                            onChange={e => updateCol('output', ci, { ...col, field: e.target.value })}
                            placeholder="field.path"
                            className="w-full px-1.5 py-1 border border-green-300 rounded text-xs font-mono focus:outline-none"
                          />
                          <input
                            value={col.label}
                            onChange={e => updateCol('output', ci, { ...col, label: e.target.value })}
                            placeholder="Label"
                            className="w-full px-1.5 py-1 border border-green-300 rounded text-xs focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-700 text-xs">{col.label || 'Output'}</div>
                          <div className="text-slate-400 font-mono text-xs truncate">{col.field}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeOutputCol(ci)} className="text-slate-300 hover:text-red-400 flex-shrink-0" title="Remove">✕</button>
                  </div>
                </th>
              ))}
              <th className="border-b border-r border-slate-200 px-1 py-1 bg-green-50 w-8">
                <button onClick={addOutputCol} className="w-5 h-5 rounded bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center font-bold mx-auto" title="Add output">+</button>
              </th>

              <th className="border-b border-slate-200 px-2 py-1 bg-slate-50 text-slate-400 font-normal">Description</th>
              <th className="border-b border-slate-200 w-14 bg-slate-50"></th>
            </tr>
          </thead>
          <tbody>
            {(data.rows || []).map((row, ri) => (
              <tr key={row.id} className="hover:bg-slate-50/60 group">
                <td className="border-b border-r border-slate-100 px-2 py-1.5 text-slate-400 text-center font-mono">{ri + 1}</td>

                {/* Condition cells — inline expression */}
                {(data.inputs || []).map((_, ci) => {
                  const expr = getConditionExpr(row.conditions?.[ci]);
                  return (
                    <td key={ci} className="border-b border-r border-slate-100 px-1.5 py-1.5">
                      <input
                        value={expr}
                        onChange={e => updateConditionExpr(row.id, ci, e.target.value)}
                        placeholder="— any —"
                        className={`w-full px-2 py-1 border rounded text-xs font-mono focus:outline-none focus:border-blue-400 bg-white
                          ${expr === '' ? 'border-slate-200 text-slate-400' : 'border-blue-200 text-blue-700 font-semibold'}`}
                      />
                    </td>
                  );
                })}
                <td className="border-b border-r border-slate-100 w-8"></td>

                {/* Output cells */}
                {(data.outputs || []).map((_, ci) => {
                  const val = row.outputs?.[ci]?.value || '';
                  return (
                    <td key={ci} className="border-b border-r border-slate-100 px-1.5 py-1.5">
                      <input
                        value={val}
                        onChange={e => updateOutput(row.id, ci, e.target.value)}
                        placeholder='"value"'
                        className={`w-full px-2 py-1 border rounded text-xs font-mono focus:outline-none focus:border-green-400 bg-white
                          ${val === '' ? 'border-slate-200 text-slate-400' : 'border-green-200 text-green-700 font-semibold'}`}
                      />
                    </td>
                  );
                })}
                <td className="border-b border-r border-slate-100 w-8"></td>

                {/* Annotation */}
                <td className="border-b border-r border-slate-100 px-1.5 py-1.5">
                  <input
                    value={row.annotation || ''}
                    onChange={e => {
                      const rows = data.rows.map(r => r.id === row.id ? { ...r, annotation: e.target.value } : r);
                      update({ rows });
                    }}
                    placeholder="note..."
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-400 bg-white"
                  />
                </td>

                {/* Row actions */}
                <td className="border-b border-slate-100 px-1 py-1">
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveRow(ri, -1)} disabled={ri === 0} className="p-0.5 hover:text-blue-500 disabled:opacity-30 text-slate-400" title="Up">↑</button>
                    <button onClick={() => moveRow(ri, 1)} disabled={ri === data.rows.length - 1} className="p-0.5 hover:text-blue-500 disabled:opacity-30 text-slate-400" title="Down">↓</button>
                    <button onClick={() => removeRow(row.id)} className="p-0.5 hover:text-red-500 text-slate-400" title="Delete">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-3">
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-blue-300 transition-colors"
          >
            <span className="font-bold text-base leading-none">+</span> Add row
          </button>
        </div>
      </div>
    </div>
  );
}
