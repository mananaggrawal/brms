export type NodeType = 'request' | 'response' | 'decisionTable' | 'function' | 'expression' | 'switch';
export type HitPolicy = 'first' | 'all' | 'collect';
export type RulesetStatus = 'draft' | 'published';

export interface DecisionCondition {
  // New: single inline expression like ">= 750", "false", "true", "null", '"accept"'
  expression?: string;
  // Legacy: explicit operator + value (kept for backward compat)
  operator?: string;
  value?: string;
}

export interface DecisionOutput {
  value: string;
}

export interface DecisionRow {
  id: string;
  conditions: (DecisionCondition | null)[];
  outputs: (DecisionOutput | null)[];
  annotation?: string;
}

export interface ColumnDef {
  field: string;
  label: string;
}

export interface DecisionTableData {
  label: string;
  hitPolicy: HitPolicy;
  inputs: ColumnDef[];
  outputs: ColumnDef[];
  rows: DecisionRow[];
}

export interface FunctionData {
  label: string;
  code: string;
}

export interface ExpressionData {
  label: string;
  expression: string;
  outputField: string;
  trueValue: string;
  falseValue: string;
}

export interface SwitchBranch {
  id: string;
  label: string;       // "If" | "Else If" | "Else"
  expression: string;  // JS expression like ">= 750", "false", 'input.x === "yes"'
  port: string;        // unique handle ID
  isElse?: boolean;
}

export interface SwitchData {
  label: string;
  hitPolicy: 'first' | 'collect';
  branches: SwitchBranch[];
}

export interface RequestData {
  label: string;
}

export interface ResponseData {
  label: string;
  outputFields: ColumnDef[];
}

export type AnyNodeData = DecisionTableData | FunctionData | ExpressionData | SwitchData | RequestData | ResponseData;

export interface RuleNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: AnyNodeData;
}

export interface RuleEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

export interface Ruleset {
  id: string;
  name: string;
  description: string;
  status: RulesetStatus;
  createdAt: string;
  updatedAt: string;
  nodes: RuleNode[];
  edges: RuleEdge[];
}

export interface RulesetSummary {
  id: string;
  name: string;
  description: string;
  status: RulesetStatus;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
}

// Simulation trace
export interface TraceEntry {
  nodeId: string;
  nodeType: NodeType;
  nodeLabel: string;
  skipped?: boolean;
  error?: string;
  info?: string;
  matchedRows?: { rowId: string; outputs: Record<string, unknown> }[];
  expressionResult?: boolean;
  matchedPort?: string;
  logs?: string[];
  contextSnapshot?: Record<string, unknown>;
  duration?: number;
}

export interface SimulationResult {
  output: Record<string, unknown>;
  context: Record<string, unknown>;
  trace: TraceEntry[];
}
