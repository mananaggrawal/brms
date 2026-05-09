import Editor from '@monaco-editor/react';
import type { FunctionData } from '../../types';

const DEFAULT_CODE = `export const handler = async (input) => {
  // Access any field from the input context
  // e.g. const score = input.customer?.credit_score;

  // Return an object to merge into the context
  return {
    // result: { decision: "approve" }
  };
};`;

interface Props {
  data: FunctionData;
  onChange: (data: FunctionData) => void;
  consoleLogs?: string[];
}

export default function FunctionEditor({ data, onChange, consoleLogs }: Props) {
  const update = (patch: Partial<FunctionData>) => onChange({ ...data, ...patch });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        <label className="text-xs font-medium text-slate-500">Label</label>
        <input
          value={data.label || ''}
          onChange={e => update({ label: e.target.value })}
          className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-amber-400 flex-1 min-w-0"
        />
        <span className="text-[10px] text-slate-400 font-mono shrink-0">async (input) → object</span>
      </div>

      {/* File tab */}
      <div className="flex items-center px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <span className="text-xs font-mono text-amber-400">handler.js</span>
        <span className="ml-3 text-[10px] text-slate-500">return an object to merge into context</span>
      </div>

      {/* Monaco — takes all remaining space except console */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={data.code || DEFAULT_CODE}
          onChange={v => update({ code: v || '' })}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            padding: { top: 10, bottom: 10 },
          }}
        />
      </div>

      {/* Console panel — always visible, shows output after simulation */}
      <div className="flex-shrink-0 border-t border-slate-700 bg-slate-900" style={{ minHeight: 80, maxHeight: 180 }}>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Console</span>
            {consoleLogs && consoleLogs.length > 0 && (
              <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-px font-bold">{consoleLogs.length}</span>
            )}
          </div>
          {!consoleLogs && (
            <span className="text-[10px] text-slate-600">Run simulator to see output</span>
          )}
          {consoleLogs && consoleLogs.length === 0 && (
            <span className="text-[10px] text-slate-600">No output from last run</span>
          )}
        </div>

        <div className="overflow-y-auto px-3 py-2 space-y-0.5" style={{ maxHeight: 140 }}>
          {(!consoleLogs || consoleLogs.length === 0) && (
            <div className="text-[11px] text-slate-600 font-mono italic">
              {consoleLogs ? '// (empty)' : '// console.log() output will appear here after simulation'}
            </div>
          )}
          {consoleLogs?.map((line, i) => {
            const isError = line.startsWith('[ERROR]');
            const isWarn  = line.startsWith('[WARN]');
            return (
              <div
                key={i}
                className={`text-[11px] font-mono leading-relaxed ${
                  isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-green-400'
                }`}
              >
                <span className="text-slate-600 select-none mr-2">{i + 1}</span>
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
