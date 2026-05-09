import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../api';
import type { SimulationResult, TraceEntry } from '../types';

const NODE_COLORS: Record<string, { bg: string; text: string }> = {
  request:       { bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  response:      { bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  decisionTable: { bg: 'bg-blue-50',     text: 'text-blue-700'    },
  function:      { bg: 'bg-amber-50',    text: 'text-amber-700'   },
  expression:    { bg: 'bg-violet-50',   text: 'text-violet-700'  },
  switch:        { bg: 'bg-rose-50',     text: 'text-rose-700'    },
};

interface Props {
  rulesetId: string;
  onClose: () => void;
  inputJson: string;
  onInputChange: (v: string) => void;
  onResult?: (result: SimulationResult | null) => void;
}

function StatusDot({ entry }: { entry: TraceEntry }) {
  if (entry.error)                         return <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />;
  if (entry.skipped)                       return <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />;
  if (entry.matchedRows?.length === 0)     return <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />;
  return                                          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />;
}

function TraceRow({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const c = NODE_COLORS[entry.nodeType] || { bg: 'bg-slate-50', text: 'text-slate-600' };
  const hasDetail = !!(entry.error || entry.matchedRows?.length || entry.logs?.length || entry.expressionResult !== undefined || entry.matchedPort || entry.contextSnapshot);

  return (
    <div className={`rounded-lg border overflow-hidden ${entry.error ? 'border-red-200' : entry.skipped ? 'border-slate-100' : 'border-slate-200'}`}>
      <button
        disabled={!hasDetail}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${hasDetail ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'} ${entry.skipped ? 'opacity-50' : ''}`}
      >
        <StatusDot entry={entry} />
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${c.bg} ${c.text}`}>{entry.nodeType}</span>
        <span className="text-xs font-medium text-slate-700 flex-1 truncate">{entry.nodeLabel}</span>
        {entry.logs?.length ? <span className="text-[10px] text-amber-500 flex-shrink-0 font-medium">{entry.logs.length} log{entry.logs.length > 1 ? 's' : ''}</span> : null}
        <span className="text-[10px] text-slate-400 flex-shrink-0">{entry.duration}ms</span>
        {hasDetail && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2">
          {entry.error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-2 font-mono">{entry.error}</div>
          )}
          {entry.matchedRows !== undefined && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                {entry.matchedRows.length === 0 ? 'No rows matched' : `${entry.matchedRows.length} row${entry.matchedRows.length > 1 ? 's' : ''} matched`}
              </p>
              {entry.matchedRows.map((mr, i) => (
                <div key={i} className="text-xs font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 mb-1 space-y-0.5">
                  {Object.entries(mr.outputs).map(([k, v]) => (
                    <div key={k}><span className="text-slate-500">{k}</span><span className="text-slate-400 mx-1">=</span><span className="text-green-700 font-semibold">{JSON.stringify(v)}</span></div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {entry.expressionResult !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wide">Result</span>
              <span className={`font-bold ${entry.expressionResult ? 'text-green-600' : 'text-red-500'}`}>{String(entry.expressionResult)}</span>
            </div>
          )}
          {entry.matchedPort && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wide">Routed to</span>
              <span className="font-mono font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">{entry.matchedPort}</span>
            </div>
          )}
          {entry.logs?.length ? (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Console</p>
              <div className="bg-slate-900 rounded px-2.5 py-2 space-y-0.5">
                {entry.logs.map((l, i) => (
                  <div key={i} className={`text-[11px] font-mono leading-relaxed ${l.startsWith('[ERROR]') ? 'text-red-400' : l.startsWith('[WARN]') ? 'text-yellow-400' : 'text-green-400'}`}>{l}</div>
                ))}
              </div>
            </div>
          ) : null}
          {entry.contextSnapshot && (
            <details>
              <summary className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 select-none">Context snapshot</summary>
              <pre className="mt-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-40 leading-relaxed">
                {JSON.stringify(entry.contextSnapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function Simulator({ rulesetId, onClose, inputJson, onInputChange, onResult }: Props) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'output' | 'trace' | 'context'>('output');

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(inputJson); } catch { throw new Error('Invalid JSON input'); }
      const res = await api.simulate(rulesetId, parsed);
      setResult(res);
      onResult?.(res);
      setActiveTab('output');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* h-full fills whatever the parent gives — parent controls the height */
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* Slim header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 flex-shrink-0 bg-slate-50">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span className="font-semibold text-slate-800 text-xs">Simulator</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Side-by-side body — this div takes all remaining height */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT — Input */}
        <div className="flex flex-col w-[38%] min-w-0 border-r border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Input JSON</span>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {loading
                ? <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                : <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              }
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
          {/* Monaco fills the rest — flex-1 min-h-0 is critical */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={inputJson}
              onChange={v => onInputChange(v || '')}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 8, bottom: 8 },
                wordWrap: 'on',
                folding: false,
                renderLineHighlight: 'none',
              }}
            />
          </div>
        </div>

        {/* RIGHT — Results */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Sub-tabs */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50 flex-shrink-0">
            {(['output', 'trace', 'context'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab ? 'border-brand-500 text-brand-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
                {tab === 'trace' && result && (
                  <span className="ml-1.5 bg-slate-200 text-slate-600 rounded-full px-1.5 py-px text-[10px] font-semibold">{result.trace.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* This is the ONLY scrolling region — flex-1 min-h-0 overflow-y-auto */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {error && (
              <div className="mx-3 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
            )}

            {!result && !error && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="opacity-20 mb-2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <p className="text-xs">Enter JSON and click Run</p>
              </div>
            )}

            {result && activeTab === 'output' && (
              <div className="p-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Output</p>
                {Object.keys(result.output).length === 0
                  ? <p className="text-xs text-slate-400 italic">No output fields on Response node</p>
                  : <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap break-all">{JSON.stringify(result.output, null, 2)}</pre>
                }
              </div>
            )}

            {result && activeTab === 'trace' && (
              <div className="p-3 space-y-1.5">
                {result.trace.map((entry, i) => <TraceRow key={i} entry={entry} />)}
              </div>
            )}

            {result && activeTab === 'context' && (
              <div className="p-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Full Context</p>
                <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap break-all">{JSON.stringify(result.context, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
