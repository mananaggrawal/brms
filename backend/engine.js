const vm = require('vm');

/**
 * Parse an inline condition expression like:
 *   ">= 750"  → { op: '>=', val: 750 }
 *   "false"   → { op: '===', val: false }
 *   "true"    → { op: '===', val: true }
 *   "null"    → { op: '===', val: null }
 *   '"accept"'→ { op: '===', val: 'accept' }
 *   "accept"  → { op: '===', val: 'accept' }
 *   ""        → null (wildcard)
 */
/**
 * Parse an inline condition expression. Supports:
 *   "customer.age = 22"   → { op: '==', val: '22', overrideField: 'customer.age' }
 *   ">= 750"              → { op: '>=', val: '750' }
 *   "false" / "true"      → literal boolean match
 *   "null"                → literal null match
 *   '"accept"'            → string equality
 *   "22"                  → numeric/string equality
 *   ""                    → null (wildcard — matches anything)
 */
function parseInlineExpression(expr) {
  if (!expr || !expr.trim()) return null; // wildcard

  const t = expr.trim();

  // Full expression: "field.path operator value"  e.g. "customer.age = 22", "customer.age > 40"
  const fullExprMatch = t.match(/^([\w.[\]]+)\s*(>=|<=|!=|<>|>|<|===?|==?)\s*(.*)$/);
  if (fullExprMatch && fullExprMatch[1].includes('.')) {
    const field = fullExprMatch[1];
    const rawOp = fullExprMatch[2];
    const val   = fullExprMatch[3].trim();
    const op    = rawOp === '<>' ? '!=' : (rawOp === '=' ? '==' : rawOp);
    return { op, val, overrideField: field };
  }

  // Operator-only prefix: >=, <=, !=, <>, >, <, ==, =   e.g. ">= 750", "= 22"
  const opMatch = t.match(/^(>=|<=|!=|<>|>|<|===?)\s*(.*)$/);
  if (opMatch) {
    const op  = opMatch[1] === '<>' ? '!=' : (opMatch[1] === '=' ? '==' : opMatch[1]);
    const raw = opMatch[2].trim();
    return { op, val: raw };
  }

  // Special literals
  if (t === 'true')  return { op: '===', val: true,  literal: true };
  if (t === 'false') return { op: '===', val: false, literal: true };
  if (t === 'null')  return { op: '===', val: null,  literal: true };
  if (t === 'is_empty'     || t === 'empty')     return { op: 'is_empty',     val: '' };
  if (t === 'is_not_empty' || t === 'not_empty') return { op: 'is_not_empty', val: '' };

  // Quoted string → strip quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return { op: '==', val: t.slice(1, -1) };
  }

  // Numeric literal
  if (!isNaN(Number(t))) return { op: '==', val: t };

  // Default: equality against the raw string
  return { op: '==', val: t };
}

function matchInlineExpression(parsed, fieldValue) {
  if (!parsed) return true; // wildcard

  const { op, val, literal } = parsed;

  if (op === 'is_empty')     return fieldValue === undefined || fieldValue === null || fieldValue === '';
  if (op === 'is_not_empty') return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';

  // Field is missing — only equality checks against null/undefined can match
  if (fieldValue === undefined || fieldValue === null) {
    if (literal && val === null) return op === '===' || op === '==';
    return false;
  }

  if (literal) return fieldValue === val;

  const numField = Number(fieldValue);
  const numVal   = Number(val);
  const isNum    = !isNaN(numField) && !isNaN(numVal) && String(val).trim() !== '';

  switch (op) {
    case '>=':  return isNum ? numField >= numVal  : false;
    case '<=':  return isNum ? numField <= numVal  : false;
    case '>':   return isNum ? numField >  numVal  : false;
    case '<':   return isNum ? numField <  numVal  : false;
    case '==':
    case '===': return isNum ? numField === numVal : String(fieldValue) === String(val);
    case '!=':  return isNum ? numField !== numVal : String(fieldValue) !== String(val);
    default:    return false;
  }
}

function getNestedValue(obj, path) {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((curr, key) => {
    if (curr === null || curr === undefined) return undefined;
    return curr[key];
  }, obj);
}

function setNestedValue(obj, path, rawValue) {
  if (!path || typeof path !== 'string') return;
  const keys = path.split('.');
  const last = keys.pop();
  let target = obj;
  for (const key of keys) {
    if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
    target = target[key];
  }
  // Auto-parse value types
  let value = rawValue;
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed === 'true') value = true;
    else if (trimmed === 'false') value = false;
    else if (trimmed === 'null') value = null;
    else if (trimmed.startsWith('"') && trimmed.endsWith('"')) value = trimmed.slice(1, -1);
    else if (trimmed !== '' && !isNaN(Number(trimmed))) value = Number(trimmed);
  }
  target[last] = value;
}

function evaluateCondition(operator, fieldValue, conditionValue) {
  // Empty condition value = wildcard (always matches)
  if (conditionValue === '' || conditionValue === null || conditionValue === undefined) return true;
  if (operator === 'is_empty') return fieldValue === undefined || fieldValue === null || fieldValue === '';
  if (operator === 'is_not_empty') return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';

  // Missing field — can't satisfy any comparison
  if (fieldValue === undefined || fieldValue === null) return false;

  const numField = Number(fieldValue);
  const numCond = Number(conditionValue);
  const isNumeric = !isNaN(numField) && !isNaN(numCond) && String(conditionValue).trim() !== '';

  switch (operator) {
    case '>=': return isNumeric ? numField >= numCond : false;
    case '<=': return isNumeric ? numField <= numCond : false;
    case '>':  return isNumeric ? numField > numCond  : false;
    case '<':  return isNumeric ? numField < numCond  : false;
    case '==': case '=':
      return isNumeric ? numField === numCond : String(fieldValue) === String(conditionValue);
    case '!=':
      return isNumeric ? numField !== numCond : String(fieldValue) !== String(conditionValue);
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
    case 'in': {
      const vals = conditionValue.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      return vals.includes(String(fieldValue));
    }
    case 'not_in': {
      const vals = conditionValue.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      return !vals.includes(String(fieldValue));
    }
    case 'starts_with': return String(fieldValue).startsWith(String(conditionValue));
    case 'ends_with':   return String(fieldValue).endsWith(String(conditionValue));
    case 'between': {
      const [lo, hi] = conditionValue.split(',').map(v => Number(v.trim()));
      return !isNaN(numField) && numField >= lo && numField <= hi;
    }
    default: return false;
  }
}

async function executeDecisionTable(nodeData, context) {
  const { inputs = [], outputs = [], rows = [], hitPolicy = 'first' } = nodeData;
  const matchedRows = [];

  for (const row of rows) {
    const allMatch = inputs.every((input, i) => {
      const cond = row.conditions?.[i];
      if (!cond) return true;

      // New format: inline expression string
      if ('expression' in cond) {
        const parsed = parseInlineExpression(cond.expression);
        // If expression contains its own field path (e.g. "customer.age = 22"), use that field
        const resolvedField = parsed?.overrideField || input.field;
        const fieldValue = getNestedValue(context, resolvedField);
        return matchInlineExpression(parsed, fieldValue);
      }

      const fieldValue = getNestedValue(context, input.field);

      // Legacy format: { operator, value }
      if (!cond.operator && (cond.value === '' || cond.value === undefined)) return true;
      return evaluateCondition(cond.operator, fieldValue, cond.value);
    });

    if (allMatch) {
      const rowOutputs = {};
      outputs.forEach((output, i) => {
        const outVal = row.outputs?.[i]?.value;
        if (outVal !== undefined && outVal !== null && outVal !== '') {
          setNestedValue(context, output.field, outVal);
          rowOutputs[output.field] = outVal;
        }
      });
      matchedRows.push({ rowId: row.id, outputs: rowOutputs });
      if (hitPolicy === 'first') break;
    }
  }

  return { context, matchedRows };
}

async function executeFunction(nodeData, context) {
  const code = (nodeData.code || '').trim();
  if (!code) return { context };

  // Support both "export const handler = ..." and plain return statements
  const normalized = code
    .replace(/^export\s+const\s+handler\s*=\s*/, 'const handler = ')
    .replace(/^export\s+default\s+/, 'const handler = ');

  const wrappedCode = `
    ${normalized}
    if (typeof handler === 'function') {
      __result = Promise.resolve(handler(__input));
    } else {
      __result = Promise.resolve({});
    }
  `;

  const logs = [];
  const sandbox = {
    __input: JSON.parse(JSON.stringify(context)),
    __result: Promise.resolve({}),
    console: {
      log: (...args) => logs.push(args.map(String).join(' ')),
      error: (...args) => logs.push('[ERROR] ' + args.map(String).join(' ')),
      warn: (...args) => logs.push('[WARN] ' + args.map(String).join(' ')),
    },
    Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
    Number, String, Boolean, Array, Object, Promise,
  };

  try {
    vm.createContext(sandbox);
    new vm.Script(wrappedCode).runInContext(sandbox);
    const result = await sandbox.__result;
    if (result && typeof result === 'object') {
      // Deep merge result into context
      deepMerge(context, result);
    }
  } catch (err) {
    throw new Error(`Function execution error: ${err.message}`);
  }

  return { context, logs };
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

async function executeExpression(nodeData, context) {
  const { expression, outputField, trueValue, falseValue } = nodeData;
  if (!expression) return { context };

  try {
    const sandbox = {
      input: JSON.parse(JSON.stringify(context)),
      __result: false,
      Math, JSON, parseInt, parseFloat, isNaN, Number, String, Boolean,
    };
    vm.createContext(sandbox);
    new vm.Script(`__result = !!(${expression})`).runInContext(sandbox);
    const value = sandbox.__result ? (trueValue ?? true) : (falseValue ?? false);
    if (outputField) setNestedValue(context, outputField, value);
    return { context, expressionResult: sandbox.__result };
  } catch (err) {
    throw new Error(`Expression error: ${err.message}`);
  }
}

async function executeSwitch(nodeData, context) {
  const { branches = [], hitPolicy = 'first' } = nodeData;
  const matchedPorts = [];

  for (const branch of branches) {
    let matched = false;

    if (branch.isElse) {
      matched = true; // Else always matches
    } else if (!branch.expression || !branch.expression.trim()) {
      matched = true; // Empty expression = always matches
    } else {
      // Evaluate JS expression with full context as `input`
      try {
        const sandbox = {
          input: JSON.parse(JSON.stringify(context)),
          __result: false,
          Math, JSON, parseInt, parseFloat, isNaN, Number, String, Boolean,
        };
        vm.createContext(sandbox);
        new vm.Script(`__result = !!(${branch.expression})`).runInContext(sandbox);
        matched = sandbox.__result;
      } catch {
        matched = false;
      }
    }

    if (matched) {
      matchedPorts.push(branch.port);
      if (hitPolicy === 'first') break;
    }
  }

  const matchedPort = matchedPorts[0] || null;
  return { context, matchedPort, matchedPorts };
}

function topologicalSort(nodes, edges) {
  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  const adj = new Map(nodes.map(n => [n.id, []]));

  for (const edge of edges) {
    adj.get(edge.source)?.push({ to: edge.target, sourceHandle: edge.sourceHandle });
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const sorted = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    sorted.push(nodeId);
    for (const { to } of (adj.get(nodeId) || [])) {
      const newDeg = (inDegree.get(to) || 0) - 1;
      inDegree.set(to, newDeg);
      if (newDeg === 0) queue.push(to);
    }
  }

  if (sorted.length < nodes.length) {
    const cycleIds = nodes.filter(n => !sorted.includes(n.id)).map(n => n.id);
    throw new Error(`Cycle detected in graph involving nodes: ${cycleIds.join(', ')}`);
  }

  return sorted.map(id => nodes.find(n => n.id === id)).filter(Boolean);
}

async function executeRuleset(ruleset, input) {
  const { nodes, edges } = ruleset;
  const context = JSON.parse(JSON.stringify(input));
  const trace = [];
  const skippedNodes = new Set();

  const sorted = topologicalSort(nodes, edges);

  for (const node of sorted) {
    if (skippedNodes.has(node.id)) {
      trace.push({ nodeId: node.id, nodeType: node.type, nodeLabel: node.data?.label, skipped: true });
      continue;
    }

    const t0 = Date.now();
    let entry = { nodeId: node.id, nodeType: node.type, nodeLabel: node.data?.label };

    try {
      switch (node.type) {
        case 'request':
          entry.info = 'Input context initialized';
          entry.contextSnapshot = JSON.parse(JSON.stringify(context));
          break;

        case 'decisionTable': {
          const res = await executeDecisionTable(node.data, context);
          entry.matchedRows = res.matchedRows;
          entry.contextSnapshot = JSON.parse(JSON.stringify(context));
          break;
        }

        case 'function': {
          const res = await executeFunction(node.data, context);
          entry.logs = res.logs;
          entry.contextSnapshot = JSON.parse(JSON.stringify(context));
          break;
        }

        case 'expression': {
          const res = await executeExpression(node.data, context);
          entry.expressionResult = res.expressionResult;
          entry.contextSnapshot = JSON.parse(JSON.stringify(context));
          break;
        }

        case 'switch': {
          const res = await executeSwitch(node.data, context);
          entry.matchedPort = res.matchedPort;
          entry.matchedPorts = res.matchedPorts;
          entry.contextSnapshot = JSON.parse(JSON.stringify(context));

          // Skip downstream nodes not on any matched port
          // null sourceHandle means the edge isn't port-gated (always passes through)
          const outEdges = edges.filter(e => e.source === node.id);
          for (const e of outEdges) {
            const portMatched = e.sourceHandle === null || e.sourceHandle === undefined || res.matchedPorts.includes(e.sourceHandle);
            if (!portMatched) {
              skippedNodes.add(e.target);
            }
          }
          break;
        }

        case 'response':
          entry.info = 'Response collected';
          entry.contextSnapshot = JSON.parse(JSON.stringify(context));
          break;

        default:
          entry.info = 'Passthrough';
      }
    } catch (err) {
      entry.error = err.message;
    }

    entry.duration = Date.now() - t0;
    trace.push(entry);
  }

  // Build final output
  const responseNode = nodes.find(n => n.type === 'response');
  let output = context;

  if (responseNode?.data?.outputFields?.length > 0) {
    output = {};
    for (const f of responseNode.data.outputFields) {
      if (f.field) {
        const val = getNestedValue(context, f.field);
        setNestedValue(output, f.field, val);
      }
    }
  }

  return { output, context, trace };
}

module.exports = { executeRuleset };
