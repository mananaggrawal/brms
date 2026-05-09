const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { executeRuleset } = require('./engine');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_FILE = path.join(__dirname, 'data', 'rulesets.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({ rulesets: [] }));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('readData error:', err.message);
    return { rulesets: [] };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('writeData error:', err.message);
    throw new Error('Failed to persist data: ' + err.message);
  }
}

// List rulesets (summary)
app.get('/api/rulesets', (req, res) => {
  const { rulesets } = readData();
  res.json(rulesets.map(r => ({
    id: r.id, name: r.name, description: r.description,
    status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
    nodeCount: r.nodes?.length || 0,
  })));
});

// Get single ruleset (full)
app.get('/api/rulesets/:id', (req, res) => {
  const { rulesets } = readData();
  const rs = rulesets.find(r => r.id === req.params.id);
  if (!rs) return res.status(404).json({ error: 'Not found' });
  res.json(rs);
});

// Create ruleset
app.post('/api/rulesets', (req, res) => {
  const data = readData();
  const rs = {
    id: uuidv4(),
    name: req.body.name || 'Untitled Ruleset',
    description: req.body.description || '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      { id: 'node-request', type: 'request', position: { x: 60, y: 220 }, data: { label: 'Request' } },
      { id: 'node-response', type: 'response', position: { x: 760, y: 220 }, data: { label: 'Response', outputFields: [] } },
    ],
    edges: [],
  };
  data.rulesets.push(rs);
  writeData(data);
  res.status(201).json(rs);
});

// Update ruleset (graph + metadata)
app.put('/api/rulesets/:id', (req, res) => {
  const data = readData();
  const idx = data.rulesets.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.rulesets[idx] = { ...data.rulesets[idx], ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  writeData(data);
  res.json(data.rulesets[idx]);
});

// Publish ruleset
app.post('/api/rulesets/:id/publish', (req, res) => {
  const data = readData();
  const idx = data.rulesets.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.rulesets[idx].status = 'published';
  data.rulesets[idx].updatedAt = new Date().toISOString();
  writeData(data);
  res.json(data.rulesets[idx]);
});

// Delete ruleset
app.delete('/api/rulesets/:id', (req, res) => {
  const data = readData();
  const idx = data.rulesets.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.rulesets.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// Simulate
app.post('/api/rulesets/:id/simulate', async (req, res) => {
  const { rulesets } = readData();
  const rs = rulesets.find(r => r.id === req.params.id);
  if (!rs) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await executeRuleset(rs, req.body.input || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate ruleset
app.post('/api/rulesets/:id/duplicate', (req, res) => {
  const data = readData();
  const rs = data.rulesets.find(r => r.id === req.params.id);
  if (!rs) return res.status(404).json({ error: 'Not found' });
  const copy = { ...JSON.parse(JSON.stringify(rs)), id: uuidv4(), name: rs.name + ' (Copy)', status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  data.rulesets.push(copy);
  writeData(data);
  res.status(201).json(copy);
});

// Convert GoRules JDM format → our internal format
function convertFromGoRules(body) {
  const typeMap = {
    inputNode: 'request',
    outputNode: 'response',
    decisionTableNode: 'decisionTable',
    functionNode: 'function',
    switchNode: 'switch',
    expressionNode: 'expression',
  };

  const nodes = (body.nodes || []).map(n => {
    const type = typeMap[n.type] || n.type;
    const content = n.content || {};
    let nodeData;

    switch (n.type) {
      case 'inputNode':
        nodeData = { label: n.name || 'Request' };
        break;

      case 'outputNode':
        nodeData = { label: n.name || 'Response', outputFields: [] };
        break;

      case 'decisionTableNode': {
        // field may be missing on placeholder columns — fallback to name as field path
        const inputs = (content.inputs || []).map(i => ({ field: i.field || i.name || 'input', label: i.name || i.field || 'Input' }));
        const outputs = (content.outputs || []).map(o => ({ field: o.field || o.name || 'output', label: o.name || o.field || 'Output' }));
        const inputIds = (content.inputs || []).map(i => i.id);
        const outputIds = (content.outputs || []).map(o => o.id);
        const rows = (content.rules || []).map(rule => ({
          id: rule._id || uuidv4(),
          conditions: inputIds.map(id => ({ expression: rule[id] != null ? String(rule[id]) : '' })),
          outputs: outputIds.map(id => ({ value: rule[id] != null ? String(rule[id]) : '' })),
          annotation: '',
        }));
        nodeData = {
          label: n.name || 'Decision Table',
          hitPolicy: content.hitPolicy || 'first',
          inputs,
          outputs,
          rows,
        };
        break;
      }

      case 'functionNode': {
        const code = (content.source || '').replace(/^import\s+\w+\s+from\s+['"]zen['"];\n?/m, '');
        nodeData = { label: n.name || 'Function', code };
        break;
      }

      case 'switchNode': {
        // GoRules statements: [{id, condition, isDefault}]
        // We preserve statement.id as the branch port so edges with sourceHandle=statement.id still route correctly
        const statements = content.statements || [];
        let ifCount = 0;
        const branches = statements.map(stmt => {
          if (stmt.isDefault) {
            return { id: stmt.id, label: 'Else', expression: '', port: stmt.id, isElse: true };
          }
          const label = ifCount === 0 ? 'If' : 'Else If';
          ifCount++;
          return { id: stmt.id, label, expression: stmt.condition || '', port: stmt.id };
        });
        nodeData = {
          label: n.name || 'Switch',
          hitPolicy: content.hitPolicy || 'first',
          branches,
        };
        break;
      }

      default:
        nodeData = { label: n.name || type };
    }

    return { id: n.id, type, position: n.position || { x: 0, y: 0 }, data: nodeData };
  });

  const edges = (body.edges || []).map(e => ({
    id: e.id,
    source: e.sourceId || e.source || '',
    target: e.targetId || e.target || '',
    sourceHandle: e.sourceHandle || null,
    targetHandle: e.targetHandle || null,
  }));

  return { nodes, edges };
}

// Import ruleset from JSON (supports both our format and GoRules JDM format)
app.post('/api/rulesets/import', (req, res) => {
  const body = req.body;
  const data = readData();

  let nodes, edges, name, description;

  if (body.contentType === 'application/vnd.gorules.decision') {
    // GoRules format — convert
    ({ nodes, edges } = convertFromGoRules(body));
    name = body.name || 'Imported Ruleset';
    description = body.description || 'Imported from GoRules';
  } else {
    // Our own exported format
    nodes = body.nodes || [];
    edges = body.edges || [];
    name = body.name || 'Imported Ruleset';
    description = body.description || '';
  }

  const rs = {
    id: uuidv4(),
    name,
    description,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
  data.rulesets.push(rs);
  writeData(data);
  res.status(201).json(rs);
});

// Serve built frontend in production
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`BRMS backend running at http://localhost:${PORT}`));
