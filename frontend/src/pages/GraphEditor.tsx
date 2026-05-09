import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';

import { api } from '../api';
import type { Ruleset, RuleNode, NodeType, AnyNodeData, DecisionTableData, FunctionData, SimulationResult, ExpressionData, SwitchData, RequestData, ResponseData } from '../types';

import RequestNode from '../components/nodes/RequestNode';
import ResponseNode from '../components/nodes/ResponseNode';
import DecisionTableNode from '../components/nodes/DecisionTableNode';
import FunctionNode from '../components/nodes/FunctionNode';
import ExpressionNode from '../components/nodes/ExpressionNode';
import SwitchNode from '../components/nodes/SwitchNode';

import DecisionTableEditor from '../components/editors/DecisionTableEditor';
import FunctionEditor from '../components/editors/FunctionEditor';
import ExpressionEditor from '../components/editors/ExpressionEditor';
import SwitchEditor from '../components/editors/SwitchEditor';
import { RequestEditor, ResponseEditor } from '../components/editors/RequestResponseEditor';
import Simulator from '../components/Simulator';

function convertToGoRules(rs: Ruleset) {
  const typeMap: Record<string, string> = {
    request: 'inputNode',
    response: 'outputNode',
    decisionTable: 'decisionTableNode',
    function: 'functionNode',
    expression: 'expressionNode',
    switch: 'switchNode',
  };

  const nodes = rs.nodes.map(n => {
    const grType = typeMap[n.type] || n.type;
    const d = n.data as AnyNodeData;
    let content: Record<string, unknown> = {};

    switch (n.type) {
      case 'request':
      case 'response':
        content = { schema: '' };
        break;

      case 'decisionTable': {
        const dt = d as DecisionTableData;
        // Build column id map: we reuse the field as a stable key
        const inputCols = (dt.inputs || []).map((col, i) => ({ id: `in-${i}`, name: col.label, field: col.field }));
        const outputCols = (dt.outputs || []).map((col, i) => ({ id: `out-${i}`, name: col.label, field: col.field }));
        const rules = (dt.rows || []).map(row => {
          const rule: Record<string, string> = { _id: row.id };
          inputCols.forEach((col, i) => { rule[col.id] = row.conditions?.[i]?.expression ?? ''; });
          outputCols.forEach((col, i) => { rule[col.id] = row.outputs?.[i]?.value ?? ''; });
          return rule;
        });
        content = {
          hitPolicy: dt.hitPolicy || 'first',
          inputs: inputCols,
          outputs: outputCols,
          rules,
          passThrough: false,
          inputField: null,
          outputPath: null,
          executionMode: 'single',
        };
        break;
      }

      case 'function': {
        const fn = d as FunctionData;
        content = { source: fn.code || '' };
        break;
      }

      case 'expression': {
        const ex = d as ExpressionData;
        content = { expression: ex.expression || '', outputField: ex.outputField || '' };
        break;
      }

      case 'switch': {
        const sw = d as SwitchData;
        const statements = (sw.branches || []).map(b => ({
          id: b.port,
          condition: b.expression || '',
          isDefault: b.isElse ?? false,
        }));
        content = { hitPolicy: sw.hitPolicy || 'first', statements };
        break;
      }
    }

    return {
      type: grType,
      content,
      id: n.id,
      name: (d as { label?: string }).label || grType,
      position: n.position,
    };
  });

  const edges = rs.edges.map(e => ({
    id: e.id,
    sourceId: e.source,
    targetId: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    type: 'edge',
  }));

  return {
    contentType: 'application/vnd.gorules.decision',
    nodes,
    edges,
  };
}

const nodeTypes: NodeTypes = {
  request: RequestNode,
  response: ResponseNode,
  decisionTable: DecisionTableNode,
  function: FunctionNode,
  expression: ExpressionNode,
  switch: SwitchNode,
};

const PALETTE_ITEMS: { type: NodeType; label: string; desc: string; color: string; icon: string; iconColor: string }[] = [
  { type: 'decisionTable', label: 'Decision Table', desc: 'Tabular rules with conditions', color: '', icon: '⊞', iconColor: 'text-blue-500' },
  { type: 'function', label: 'Function', desc: 'Custom JavaScript logic', color: '', icon: '{}', iconColor: 'text-amber-500' },
  { type: 'expression', label: 'Expression', desc: 'Boolean expression node', color: '', icon: 'fx', iconColor: 'text-violet-500' },
  { type: 'switch', label: 'Switch', desc: 'Route based on conditions', color: '', icon: '⇄', iconColor: 'text-rose-500' },
];

function makeDefaultData(type: NodeType): AnyNodeData {
  switch (type) {
    case 'decisionTable': return {
      label: 'Decision Table',
      hitPolicy: 'first',
      inputs: [{ field: 'input.field', label: 'Input' }],
      outputs: [{ field: 'output.result', label: 'Result' }],
      rows: [],
    } as DecisionTableData;
    case 'function': return {
      label: 'Function',
      code: `export const handler = async (input) => {
  // Access context fields via input.path.to.field

  return {
    // Add fields to the shared context
  };
};`,
    } as FunctionData;
    case 'expression': return { label: 'Expression', expression: '', outputField: 'result.flag', trueValue: 'true', falseValue: 'false' };
    case 'switch': return {
      label: 'Switch',
      hitPolicy: 'first' as const,
      branches: [
        { id: 'branch-if', label: 'If', expression: '', port: 'port-if' },
        { id: 'branch-else', label: 'Else', expression: '', port: 'port-else', isElse: true },
      ],
    };
    case 'request': return { label: 'Request' };
    case 'response': return { label: 'Response', outputFields: [] };
  }
}

// ── Sample input helpers ──────────────────────────────────────────────────────

function setNestedDefault(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (!(last in cur)) cur[last] = value;
}

function buildSampleInput(nodes: Node[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const node of nodes) {
    if (node.type === 'decisionTable') {
      const data = node.data as unknown as DecisionTableData;
      for (const col of data.inputs ?? []) {
        if (col.field) setNestedDefault(result, col.field, 0);
      }
    }
  }
  return result;
}

function deepMergeDefaults(
  target: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(defaults)) {
    if (!(key in result)) {
      result[key] = defaults[key];
    } else if (
      typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key]) &&
      typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])
    ) {
      result[key] = deepMergeDefaults(
        result[key] as Record<string, unknown>,
        defaults[key] as Record<string, unknown>,
      );
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GraphEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorInput, setSimulatorInput] = useState('{\n  \n}');
  const [activeRightTab, setActiveRightTab] = useState<'node' | 'simulator'>('node');
  const [nodeConsoleLogs, setNodeConsoleLogs] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // Always derive selectedNode from live nodes array — never store the object directly
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null;

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load ruleset
  useEffect(() => {
    if (!id) return;
    api.getRuleset(id).then(rs => {
      setRuleset(rs);
      setNameValue(rs.name);
      const loadedNodes = rs.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data as unknown as Record<string, unknown> }));
      setNodes(loadedNodes);
      setEdges(rs.edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle || null, targetHandle: e.targetHandle || null })));
      const sample = buildSampleInput(loadedNodes);
      if (Object.keys(sample).length > 0) {
        setSimulatorInput(JSON.stringify(sample, null, 2));
      }
    });
  }, [id]);

  // Keep a ref to the latest nodes/edges so the debounced save always sees current state
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const doSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.updateRuleset(id, {
        nodes: nodesRef.current.map(n => ({ id: n.id, type: n.type as NodeType, position: n.position, data: n.data as unknown as AnyNodeData })) as RuleNode[],
        edges: edgesRef.current.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
      });
      setSaved(true);
      // Merge any newly added input fields into the simulator input without wiping user values
      const sample = buildSampleInput(nodesRef.current);
      if (Object.keys(sample).length > 0) {
        setSimulatorInput(prev => {
          try {
            const current = JSON.parse(prev);
            const merged = deepMergeDefaults(current, sample);
            return JSON.stringify(merged, null, 2);
          } catch {
            return JSON.stringify(sample, null, 2);
          }
        });
      }
    } finally {
      setSaving(false);
    }
  }, [id]);

  const doSaveRef = useRef(doSave);
  useEffect(() => { doSaveRef.current = doSave; }, [doSave]);

  const scheduleSave = useCallback(() => {
    setSaved(false);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => doSaveRef.current(), 1500);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({ ...connection, id: uuidv4() }, eds));
    scheduleSave();
  }, [scheduleSave]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setActiveRightTab('node');
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Drop from palette
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/brms-node') as NodeType;
    if (!type || !reactFlowWrapper.current) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = { x: e.clientX - bounds.left - 80, y: e.clientY - bounds.top - 30 };
    const newNode: Node = {
      id: uuidv4(),
      type,
      position,
      data: makeDefaultData(type) as unknown as Record<string, unknown>,
    };
    setNodes(nds => [...nds, newNode]);
    scheduleSave();
  }, [scheduleSave]);

  const updateNodeData = useCallback((nodeId: string, data: AnyNodeData) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: data as unknown as Record<string, unknown> } : n));
    scheduleSave();
  }, [scheduleSave]);

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    await doSave();
    await api.publishRuleset(id);
    setRuleset(r => r ? { ...r, status: 'published' } : r);
    setPublishing(false);
  };

  const handleSaveName = async () => {
    if (!id || !nameValue.trim()) return;
    await api.updateRuleset(id, { name: nameValue.trim() });
    setRuleset(r => r ? { ...r, name: nameValue.trim() } : r);
    setEditingName(false);
  };

  const handleExport = async () => {
    if (!id || !ruleset) return;
    const rs = await api.getRuleset(id);
    const gorules = convertToGoRules(rs);
    const blob = new Blob([JSON.stringify(gorules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ruleset.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Apply trace highlights to nodes after simulation
  const handleSimulationResult = useCallback((result: SimulationResult | null) => {
    if (!result) {
      setNodeConsoleLogs({});
    } else {
      const logs: Record<string, string[]> = {};
      result.trace.forEach(e => { if (e.logs?.length) logs[e.nodeId] = e.logs; });
      setNodeConsoleLogs(logs);
    }
    setNodes(nds => nds.map(n => {
      if (!result) {
        const d = { ...n.data } as Record<string, unknown>;
        delete d._traceStatus;
        delete d._traceMatched;
        return { ...n, data: d };
      }
      const entry = result.trace.find(t => t.nodeId === n.id);
      if (!entry) return n;
      const status = entry.error ? 'error' : entry.skipped ? 'skipped' : (entry.matchedRows?.length === 0 ? 'no_match' : 'executed');
      return { ...n, data: { ...n.data, _traceStatus: status, _traceMatched: entry.matchedRows?.length ?? null } };
    }));
  }, []);


  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return;
    if (selectedNode.type === 'request' || selectedNode.type === 'response') return;
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNodeId(null);
    scheduleSave();
  }, [selectedNode, scheduleSave]);

  // Render right panel content
  const renderPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 px-6 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 opacity-40">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          <p className="text-sm font-medium text-slate-500">No node selected</p>
          <p className="text-xs text-slate-400 mt-1">Click a node to edit it, or drag a component from the left panel</p>
        </div>
      );
    }

    const type = selectedNode.type as NodeType;
    const data = selectedNode.data as unknown as AnyNodeData;

    const editorTitle: Record<NodeType, string> = {
      request: 'Request',
      response: 'Response',
      decisionTable: 'Decision Table',
      function: 'Function',
      expression: 'Expression',
      switch: 'Switch',
    };

    const headerColors: Record<NodeType, string> = {
      request: 'bg-emerald-500',
      response: 'bg-emerald-600',
      decisionTable: 'bg-blue-500',
      function: 'bg-amber-500',
      expression: 'bg-violet-500',
      switch: 'bg-rose-500',
    };

    return (
      <div className="flex flex-col h-full">
        <div className={`${headerColors[type]} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">{editorTitle[type]}</span>
          </div>
          <div className="flex items-center gap-2">
            {type !== 'request' && type !== 'response' && (
              <button
                onClick={handleDeleteNode}
                className="text-white/70 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/20 transition-colors"
                title="Delete node"
              >
                Delete
              </button>
            )}
            <button onClick={() => setSelectedNodeId(null)} className="text-white/70 hover:text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {type === 'decisionTable' && (
            <DecisionTableEditor
              data={data as DecisionTableData}
              onChange={d => updateNodeData(selectedNode.id, d)}
            />
          )}
          {type === 'function' && (
            <FunctionEditor
              data={data as FunctionData}
              onChange={d => updateNodeData(selectedNode.id, d)}
              consoleLogs={nodeConsoleLogs[selectedNode.id]}
            />
          )}
          {type === 'expression' && (
            <ExpressionEditor
              data={data as ExpressionData}
              onChange={d => updateNodeData(selectedNode.id, d)}
            />
          )}
          {type === 'switch' && (
            <SwitchEditor
              data={data as SwitchData}
              onChange={d => updateNodeData(selectedNode.id, d)}
            />
          )}
          {type === 'request' && (
            <RequestEditor
              data={data as RequestData}
              onChange={d => updateNodeData(selectedNode.id, d)}
            />
          )}
          {type === 'response' && (
            <ResponseEditor
              data={data as ResponseData}
              onChange={d => updateNodeData(selectedNode.id, d)}
            />
          )}
        </div>
      </div>
    );
  };

  if (!ruleset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Loading ruleset...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 z-10 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          BRMS
        </button>

        <span className="text-slate-300">/</span>

        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
            className="font-semibold text-slate-800 text-sm border-b border-brand-400 outline-none bg-transparent"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="font-semibold text-slate-800 text-sm hover:text-brand-500 transition-colors">
            {ruleset.name}
          </button>
        )}

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ruleset.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {ruleset.status}
        </span>

        <div className="flex-1" />

        <span className="text-xs text-slate-400">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Unsaved changes'}
        </span>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>

        <button
          onClick={() => {
            if (showSimulator && activeRightTab === 'simulator') {
              handleSimulationResult(null);
              setShowSimulator(false);
            } else {
              setShowSimulator(true);
              setActiveRightTab('simulator');
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors font-medium ${showSimulator ? 'bg-brand-500 text-white border-brand-500' : 'text-brand-500 border-brand-200 hover:bg-brand-50'}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {showSimulator ? 'Hide Simulator' : 'Simulator'}
        </button>

        <button
          onClick={handlePublish}
          disabled={publishing || ruleset.status === 'published'}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {publishing ? 'Publishing...' : ruleset.status === 'published' ? 'Published ✓' : 'Publish'}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Main row: sidebar + canvas + right panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar — palette */}
          <div className="w-40 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Components</p>
            </div>
            <div className="py-1 overflow-auto flex-1">
              {PALETTE_ITEMS.map(item => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/brms-node', item.type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none hover:bg-slate-50 transition-colors group"
                >
                  <span className={`text-xs font-mono font-bold w-4 text-center flex-shrink-0 ${item.iconColor}`}>{item.icon}</span>
                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 truncate">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">Drag onto canvas</p>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative min-w-0" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={e => { onNodesChange(e); scheduleSave(); }}
              onEdgesChange={e => { onEdgesChange(e); scheduleSave(); }}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode="Delete"
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={n => {
                  const colors: Record<string, string> = {
                    request: '#10b981', response: '#059669',
                    decisionTable: '#3b82f6', function: '#f59e0b',
                    expression: '#8b5cf6', switch: '#f43f5e',
                  };
                  return colors[n.type as string] || '#94a3b8';
                }}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
              />
              <Panel position="bottom-center">
                <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 shadow-sm">
                  {nodes.length} nodes · {edges.length} edges · Delete key removes selected
                </div>
              </Panel>
            </ReactFlow>
          </div>

          {/* Right panel — node editor + simulator as tabs */}
          {(selectedNode || showSimulator) && (
            <div
              className={`bg-white border-l border-slate-200 flex flex-col flex-shrink-0 ${
                activeRightTab === 'node' && selectedNode?.type === 'decisionTable' ? 'w-[640px]' : 'w-[400px]'
              }`}
            >
              {/* Tab bar */}
              <div className="flex items-center border-b border-slate-200 bg-slate-50 flex-shrink-0">
                {selectedNode && (
                  <button
                    onClick={() => setActiveRightTab('node')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      activeRightTab === 'node'
                        ? 'border-brand-500 text-brand-600 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Node
                  </button>
                )}
                {showSimulator && (
                  <button
                    onClick={() => setActiveRightTab('simulator')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                      activeRightTab === 'simulator'
                        ? 'border-brand-500 text-brand-600 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Simulator
                  </button>
                )}
                <div className="flex-1" />
                {/* Close the active panel */}
                <button
                  onClick={() => {
                    if (activeRightTab === 'node') {
                      setSelectedNodeId(null);
                      if (showSimulator) setActiveRightTab('simulator');
                    } else {
                      handleSimulationResult(null);
                      setShowSimulator(false);
                      if (selectedNode) setActiveRightTab('node');
                    }
                  }}
                  className="px-3 py-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeRightTab === 'node' && renderPanel()}
                {activeRightTab === 'simulator' && (
                  <Simulator
                    rulesetId={id!}
                    inputJson={simulatorInput}
                    onInputChange={setSimulatorInput}
                    onResult={handleSimulationResult}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
