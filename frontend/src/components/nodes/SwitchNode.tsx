import { useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import type { SwitchData, SwitchBranch } from '../../types';

const BRANCH_SPACING = 72; // px between handles
const HEADER_HEIGHT = 42;

export default function SwitchNode({ data, selected, id }: NodeProps) {
  const d = data as unknown as SwitchData;
  const { updateNodeData } = useReactFlow();

  const branches: SwitchBranch[] = d.branches?.length
    ? d.branches
    : [
        { id: 'branch-if', label: 'If', expression: '', port: 'port-if' },
        { id: 'branch-else', label: 'Else', expression: '', port: 'port-else', isElse: true },
      ];

  const update = useCallback(
    (newBranches: SwitchBranch[]) => {
      updateNodeData(id, { ...d, branches: newBranches });
    },
    [id, d, updateNodeData]
  );

  const addBranch = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const elseIdx = branches.findIndex(b => b.isElse);
      const newBranch: SwitchBranch = {
        id: uuidv4(),
        label: 'Else If',
        expression: '',
        port: uuidv4(),
      };
      const next = [...branches];
      next.splice(elseIdx, 0, newBranch);
      update(next);
    },
    [branches, update]
  );

  const removeBranch = useCallback(
    (branchId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      update(branches.filter(b => b.id !== branchId));
    },
    [branches, update]
  );

  const updateExpression = useCallback(
    (branchId: string, expression: string) => {
      update(branches.map(b => b.id === branchId ? { ...b, expression } : b));
    },
    [branches, update]
  );

  const nodeHeight = HEADER_HEIGHT + branches.length * BRANCH_SPACING + 44;
  const traceStatus = (data as Record<string, unknown>)._traceStatus as string | undefined;
  const traceClass = traceStatus === 'executed' ? 'border-green-500 shadow-lg shadow-green-100'
    : traceStatus === 'no_match' ? 'border-yellow-400 shadow-lg shadow-yellow-100'
    : traceStatus === 'error' ? 'border-red-500 shadow-lg shadow-red-100'
    : traceStatus === 'skipped' ? 'border-slate-300 opacity-60'
    : null;

  return (
    <div
      className={`bg-white rounded-xl shadow-md border-2 w-64 transition-all ${traceClass || (selected ? 'border-violet-500' : 'border-violet-200')}`}
      style={{ minHeight: nodeHeight }}
    >
      {/* Header */}
      <div className="bg-violet-500 rounded-t-[10px] px-3 py-2.5 flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
        </svg>
        <span className="text-white text-xs font-semibold flex-1 truncate">{d.label || 'Switch'}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium bg-white/20 text-white`}>
          {d.hitPolicy === 'collect' ? 'Collect' : 'First'}
        </span>
      </div>

      {/* Branches */}
      <div className="divide-y divide-slate-100">
        {branches.map((branch, i) => {
          // Position handle vertically centred on this branch row
          const handleTop = HEADER_HEIGHT + i * BRANCH_SPACING + BRANCH_SPACING / 2;

          return (
            <div key={branch.id} className="px-3 py-2.5 relative" style={{ minHeight: BRANCH_SPACING }}>
              <div className="flex items-center gap-1 mb-1.5">
                <span className={`text-xs font-bold ${branch.isElse ? 'text-slate-400' : 'text-violet-600'}`}>
                  {branch.label}
                </span>
                {!branch.isElse && (
                  <button
                    className="ml-auto text-slate-300 hover:text-red-400 nodrag nopan"
                    onClick={(e) => removeBranch(branch.id, e)}
                    title="Remove branch"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                )}
              </div>
              {!branch.isElse ? (
                <input
                  className="nodrag nopan w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400 bg-white"
                  placeholder='e.g. input.score >= 700'
                  value={branch.expression}
                  onChange={e => updateExpression(branch.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                />
              ) : (
                <div className="text-xs text-slate-400 italic px-2 py-1.5 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                  fallback — always matches
                </div>
              )}

              {/* Per-branch source handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={branch.port}
                style={{
                  top: handleTop,
                  right: -6,
                  position: 'absolute',
                  transform: 'none',
                }}
                className="!bg-violet-400 !border-violet-500 !w-3 !h-3"
              />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
        <button
          className="nodrag nopan text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
          onClick={addBranch}
        >
          <span className="font-bold">+</span> Add Condition
        </button>
        <select
          className="nodrag nopan text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-violet-400 bg-white text-slate-600"
          value={d.hitPolicy || 'first'}
          onChange={e => { updateNodeData(id, { ...d, hitPolicy: e.target.value }); }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <option value="first">First</option>
          <option value="collect">Collect</option>
        </select>
      </div>

      {/* Target handle */}
      <Handle type="target" position={Position.Left} className="!bg-violet-400 !border-violet-500" />
    </div>
  );
}
