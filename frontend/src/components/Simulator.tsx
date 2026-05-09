import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../api';
import type { SimulationResult, TraceEntry } from '../types';

const NODE_TYPE_COLORS: Record<string, string> = {
  request: 'text-emerald-600 bg-emerald-50',
  response: 'text-emerald-700 bg-emerald-50',
  decisionTable: 'text-blue-600 bg-blue-50',
  function: 'text-amber-600 bg-amber-50',
  expression: 'text-violet-600 bg-violet-50',
  switch: 'text-rose-600 bg-rose-50',
};

interface Props {
  rulesetId: string;
  onClose: () => void;
  inputJson: string;
  onInputChange: (v: string) => void;
  onResult?: (result: SimulationResult | null) => void;
}

function TraceNode({ entry }: { entry: TraceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = NODE_TYPE_COLORS[entry.nodeType] || 'text-slate-600 bg-slate-50';
  const hasDetails = entry.matchedRows || entry.contextSnapshot || entry.logs || entry.expressionResult !== undefined;

  return (
    <div className={`border rounded-lg overflow-hidden ${entry.error ? 'border-red-200' : entry.skipped ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-slate-50 text-left"
        onClick={() => hasDetails && setExpanded(e => !e)}
      >
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{entry.nodeType}</span>
        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{entry.nodeLabel}</span>
        {entry.error && <span className="text-xs text-red-500 font-medium">Error</span>}
        {entry.skipped && <span className="text-xs text-slate-400">Skipped</span>}
        {entry.duration !== undefined && <span className="text-xs text-slate-400">{entry.duration}ms</span>}
        {hasDetails && (
          <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2">
          {entry.error && (
            <div className="text-xs text-red-600 bg-red-50 rounded p-2 font-mono">{entry.error}</div>
          )}

          {entry.matchedRows !== undefined && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Matched rows: {entry.matchedRows.length}
              </div>
              {entry.matchedRows.map((mr, i) => (
                <div key={i} className="text-xs font-mono bg-white border border-slate-200 rounded p-2 mb-1">
                  {Object.entries(mr.outputs).map(([k, v]) => (
                    <div key={k}><span className="text-green-700">{k}</span> = <span className="text-blue-700">{JSON.stringify(v)}</span></div>
                  ))}
                </div>
              ))}
              {entry.matchedRows.length === 0 && (
                <div className="text-xs text-slate-400 italic">No rows matched</div>
              )}
            </div>
          )}

          {entry.expressionResult !== undefined && (
            <div className="text-xs">
              Expression: <span className={`font-medium ${entry.expressionResult ? 'text-green-600' : 'text-red-600'}`}>{String(entry.expressionResult)}</span>
            </div>
          )}

          {entry.matchedPort && (
            <div className="text-xs">
              Routed to: <span className="font-mono font-medium text-rose-600">{entry.matchedPort}</span>
            </div>
          )}

          {entry.logs?.length ? (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Console</div>
              {entry.logs.map((l, i) => (
                <div key={i} className="text-xs font-mono text-slate-600 bg-slate-800 text-green-400 rounded px-2 py-0.5">{l}</div>
              ))}
            </div>
          ) : null}

          {entry.contextSnapshot && (
            <details>
              <summary className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700">Context snapshot</summary>
              <pre className="mt-1 text-xs font-mono bg-white border border-slate-200 rounded p-2 overflow-auto max-h-40">
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
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span className="font-semibold text-slate-800 text-sm">Simulator</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Input */}
        <div className="flex flex-col" style={{ height: '40%' }}>
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Input JSON</span>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
              {loading ? 'Running...' : 'Run'}
            </button>
          </div>
          <div className="flex-1">
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
                padding: { top: 8 },
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col flex-1 overflow-hidden border-t border-slate-200">
          <div className="flex items-center gap-1 px-4 pt-2 bg-slate-50 border-b border-slate-100">
            {(['output', 'trace', 'context'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t capitalize transition-colors ${activeTab === tab ? 'text-brand-500 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab}
                {tab === 'trace' && result && (
                  <span className="ml-1 text-xs bg-slate-200 rounded-full px-1.5">{result.trace.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
            )}

            {!result && !error && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-40"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Enter JSON input and click Run
              </div>
            )}

            {result && activeTab === 'output' && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Output</div>
                <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              </div>
            )}

            {result && activeTab === 'trace' && (
              <div className="space-y-2">
                {result.trace.map((entry, i) => (
                  <TraceNode key={i} entry={entry} />
                ))}
              </div>
            )}

            {result && activeTab === 'context' && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Full Context</div>
                <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto">
                  {JSON.stringify(result.context, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
