const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { executeRuleset } = require('./engine');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rulesets (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
}

async function getRulesets() {
  const { rows } = await pool.query('SELECT data FROM rulesets ORDER BY (data->>\'createdAt\') ASC');
  return rows.map(r => r.data);
}

async function getRuleset(id) {
  const { rows } = await pool.query('SELECT data FROM rulesets WHERE id = $1', [id]);
  return rows[0]?.data || null;
}

async function saveRuleset(rs) {
  await pool.query(
    'INSERT INTO rulesets (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
    [rs.id, rs]
  );
}

async function deleteRuleset(id) {
  await pool.query('DELETE FROM rulesets WHERE id = $1', [id]);
}

// List rulesets (summary)
app.get('/api/rulesets', async (req, res) => {
  try {
    const rulesets = await getRulesets();
    res.json(rulesets.map(r => ({
      id: r.id, name: r.name, description: r.description,
      status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
      nodeCount: r.nodes?.length || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single ruleset (full)
app.get('/api/rulesets/:id', async (req, res) => {
  try {
    const rs = await getRuleset(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    res.json(rs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create ruleset
app.post('/api/rulesets', async (req, res) => {
  try {
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
    await saveRuleset(rs);
    res.status(201).json(rs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update ruleset (graph + metadata)
app.put('/api/rulesets/:id', async (req, res) => {
  try {
    const existing = await getRuleset(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
    await saveRuleset(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish ruleset
app.post('/api/rulesets/:id/publish', async (req, res) => {
  try {
    const rs = await getRuleset(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    rs.status = 'published';
    rs.updatedAt = new Date().toISOString();
    await saveRuleset(rs);
    res.json(rs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete ruleset
app.delete('/api/rulesets/:id', async (req, res) => {
  try {
    const rs = await getRuleset(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    await deleteRuleset(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate
app.post('/api/rulesets/:id/simulate', async (req, res) => {
  try {
    const rs = await getRuleset(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    const result = await executeRuleset(rs, req.body.input || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate ruleset
app.post('/api/rulesets/:id/duplicate', async (req, res) => {
  try {
    const rs = await getRuleset(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    const copy = {
      ...JSON.parse(JSON.stringify(rs)),
      id: uuidv4(),
      name: rs.name + ' (Copy)',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveRuleset(copy);
    res.status(201).json(copy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
app.post('/api/rulesets/import', async (req, res) => {
  try {
    const body = req.body;
    let nodes, edges, name, description;

    if (body.contentType === 'application/vnd.gorules.decision') {
      ({ nodes, edges } = convertFromGoRules(body));
      name = body.name || 'Imported Ruleset';
      description = body.description || 'Imported from GoRules';
    } else {
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
    await saveRuleset(rs);
    res.status(201).json(rs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
initDb()
  .then(() => app.listen(PORT, () => console.log(`BRMS backend running at http://localhost:${PORT}`)))
  .catch(err => { console.error('DB init failed:', err.message); process.exit(1); });
