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
}

export default function FunctionEditor({ data, onChange }: Props) {
  const update = (patch: Partial<FunctionData>) => onChange({ ...data, ...patch });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Label</label>
          <input
            value={data.label || ''}
            onChange={e => update({ label: e.target.value })}
            className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-amber-400 w-48"
          />
        </div>
        <div className="ml-auto text-xs text-slate-400">
          JavaScript · <code className="font-mono">async (input) =&gt; object</code>
        </div>
      </div>

      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono border-b border-slate-700">
        <span className="text-amber-400">handler.js</span>
        <span className="ml-4 text-slate-500">// Tip: return an object to merge into the shared context</span>
      </div>

      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={data.code || DEFAULT_CODE}
          onChange={v => update({ code: v || '' })}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
}
