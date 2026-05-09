import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../api';
import type { SimulationResult, TraceEntry } from '../types';

const NODE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  request:       { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-400' },
  response:      { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  decisionTable: { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-400' },
  function:      { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400' },
  expression:    { bg: 'bg-violet-50',   text: 'text-violet-700',  dot: 'bg-violet-400' },
  switch:        { bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-400' },
};

interface Props {
  rulesetId: string;
  inputJson: string;
  onInputChange: (v: string) => void;
  onResult?: (result: SimulationResult | null) => void;
}

function StatusIcon({ status }: { status: 'ok' | 'error' | 'skipped' | 'no_match' }) {
  if (status === 'ok')       return <span className="w-4 h-4 rounded-full bg-green-400 flex-shrink-0 inline-block" />;
  if (status === 'error')    return <span className="w-4 h-4 rounded-full bg-red-400 flex-shrink-0 inline-block" />;
  if (status === 'no_match') return <span className="w-4 h-4 rounded-full bg-yellow-400 flex-shrink-0 inline-block" />;
  return <span className="w-4 h-4 rounded-full bg-slate-300 flex-shrink-0 inline-block" />;
}

function TraceRow({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const colors = NODE_COLORS[entry.nodeType] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };
  const status: 'ok' | 'error' | 'skipped' | 'no_match' =
    entry.error ? 'error' : entry.skipped ? 'skipped' : entry.matchedRows?.length === 0 ? 'no_match' : 'ok';
  const hasDetail = !!(entry.error || entry.matchedRows?.length || entry.logs?.length || entry.expressionResult !== undefined || entry.matchedPort || entry.contextSnapshot);

  return (
    <div className={`rounded-lg border overflow-hidden ${entry.error ? 'border-red-200' : entry.skipped ? 'border-slate-100' : 'border-slate-200'}`}>
      <button
        disabled={!hasDetail}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${hasDetail ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'} ${entry.skipped ? 'opacity-50' : ''}`}
      >
        <StatusIcon status={status} />
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} flex-shrink-0`}>
          {entry.nodeType}
        </span>
        <span className="text-xs font-medium text-slate-700 flex-1 truncate">{entry.nodeLabel}</span>
        <span className="text-[10px] text-slate-400 flex-shrink-0">{entry.duration}ms</span>
        {hasDetail && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2.5">
          {entry.error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 font-mono leading-relaxed">
              {entry.error}
            </div>
          )}

          {entry.matchedRows !== undefined && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                {entry.matchedRows.length === 0 ? 'No rows matched' : `${entry.matchedRows.length} row${entry.matchedRows.length > 1 ? 's' : ''} matched`}
              </p>
              {entry.matchedRows.map((mr, i) => (
                <div key={i} className="text-xs font-mono bg-white border border-slate-200 rounded-md px-2.5 py-2 mb-1 space-y-0.5">
                  {Object.entries(mr.outputs).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-slate-500">{k}</span>
                      <span className="text-slate-400 mx-1">=</span>
                      <span className="text-green-700 font-semibold">{JSON.stringify(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {entry.expressionResult !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Result</span>
              <span className={`text-xs font-bold ${entry.expressionResult ? 'text-green-600' : 'text-red-500'}`}>
                {String(entry.expressionResult)}
              </span>
            </div>
          )}

          {entry.matchedPort && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Routed to</span>
              <span className="text-xs font-mono font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{entry.matchedPort}</span>
            </div>
          )}

          {entry.logs?.length ? (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Console</p>
              <div className="bg-slate-900 rounded-md px-2.5 py-2 space-y-0.5">
                {entry.logs.map((l, i) => (
                  <div key={i} className="text-[11px] font-mono text-green-400 leading-relaxed">{l}</div>
                ))}
              </div>
            </div>
          ) : null}

          {entry.contextSnapshot && (
            <details>
              <summary className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 select-none">
                Context snapshot
              </summary>
              <pre className="mt-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-md p-2.5 overflow-x-auto max-h-48 leading-relaxed">
                {JSON.stringify(entry.contextSnapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function Simulator({ rulesetId, inputJson, onInputChange, onResult }: Props) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'output' | 'trace' | 'context'>('output');

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(inputJson); } catch { throw new Error('Invalid JSON — check for missing commas or quotes'); }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
  };

  const hasOutput = result && Object.keys(result.output).length > 0;

  return (
    <div className="flex flex-col h-full bg-white" onKeyDown={handleKeyDown}>

      {/* Input section */}
      <div className="flex flex-col flex-shrink-0 border-b border-slate-200" style={{ height: 220 }}>
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Input JSON</span>
          <span className="text-[10px] text-slate-400">⌘ Enter to run</span>
        </div>
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            defaultLanguage="json"
            value={inputJson}
            onChange={v => onInputChange(v || '')}
            theme="vs"
            options={{
              minimap: { enabled: false },
              fontSize: 11,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 6, bottom: 6 },
              wordWrap: 'on',
              folding: false,
              renderLineHighlight: 'none',
            }}
          />
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white transition-colors flex-shrink-0"
      >
        {loading ? (
          <>
            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Running…
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Run
          </>
        )}
      </button>

      {/* Results */}
      <div className="flex flex-col flex-1 min-h-0">
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Error banner */}
          {error && (
            <div className="mx-3 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!result && !error && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none pt-8">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="opacity-20 mb-3">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <p className="text-xs font-medium text-slate-400">Edit input and click Run</p>
              <p className="text-[11px] text-slate-300 mt-1">or press ⌘ Enter</p>
            </div>
          )}

          {/* Output tab */}
          {result && activeTab === 'output' && (
            <div className="p-3 space-y-3">
              {hasOutput ? (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Output</p>
                  <div className="space-y-1.5">
                    {Object.entries(result.output).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-slate-600 flex-shrink-0">{k}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">→</span>
                        <span className="text-xs font-semibold text-slate-900 font-mono break-all">{JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic px-1 pt-2">No output fields configured on the Response node</div>
              )}
            </div>
          )}

          {/* Trace tab */}
          {result && activeTab === 'trace' && (
            <div className="p-3 space-y-1.5">
              {result.trace.map((entry, i) => (
                <TraceRow key={i} entry={entry} />
              ))}
            </div>
          )}

          {/* Context tab */}
          {result && activeTab === 'context' && (
            <div className="p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Full Context</p>
              <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto leading-relaxed">
                {JSON.stringify(result.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
