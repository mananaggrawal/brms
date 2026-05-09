# BRMS — Business Rules Management System

A visual, graph-based rule engine for building, managing, and simulating decision flows — inspired by GoRules/Bureau.

**Live:** https://brms-production.up.railway.app  
**GitHub:** https://github.com/mananaggrawal/brms

---

## What is BRMS?

BRMS lets you model complex business logic as a **directed acyclic graph** (DAG) of connected nodes. Instead of hardcoding rules in application code, you build them visually, simulate them against real inputs, then publish. Common use-cases include credit decisioning, loan eligibility, fraud scoring, product eligibility, and any multi-step conditional workflow.

---

## Features

### Visual Graph Editor
Drag nodes from the sidebar onto the canvas. Connect them by drawing edges between handles. The graph is auto-saved after every edit (1.5 s debounce). Nodes can be repositioned freely; the execution order is determined by the graph topology, not the visual layout.

### Node Types

| Node | Purpose |
|---|---|
| **Request** | Entry point — represents the JSON input to the ruleset |
| **Response** | Exit point — collects selected fields into the final output |
| **Decision Table** | Tabular IF/THEN rules with configurable hit policy |
| **Function** | Full JavaScript with access to the execution context |
| **Expression** | Single boolean expression that writes a value to a context field |
| **Switch** | Conditional router — branches downstream execution based on expressions |

### Decision Tables
Each table has input columns (conditions) and output columns (values to write). Supported condition syntax:

| Expression | Meaning |
|---|---|
| `>= 750` | numeric greater-than-or-equal |
| `< 30` | numeric less-than |
| `"accept"` | string equality |
| `true` / `false` | boolean equality |
| `null` | null check |
| `is_empty` / `is_not_empty` | empty/present check |
| *(blank)* | wildcard — always matches |

**Hit policies:**
- **First** — stop at the first matching row (default)
- **All** — evaluate all rows, all matches apply
- **Collect** — evaluate all rows, collect outputs into arrays

### Function Nodes
Full JavaScript editor (Monaco) with access to the entire execution context as `input`. Return an object to merge into the context:

```js
const handler = (input) => {
  const score = input.creditScore;
  const dti   = input.debtToIncome;
  return {
    riskBand: score >= 750 ? 'low' : score >= 600 ? 'medium' : 'high',
    eligible: score >= 600 && dti < 0.5,
  };
};
```

### Expression Nodes
Single boolean expression evaluated against the context. The result is written to a configurable output field:

```
input.creditScore >= 700 && input.income > 50000
```

### Switch Nodes
Route execution to different downstream branches. Each branch is an If / Else If / Else with a JS expression. Hit policies: **first** (one branch wins) or **collect** (all matching branches execute).

### Simulator
Bottom panel for testing a ruleset without publishing:
1. The input box is **auto-populated** with a sample JSON derived from all decision table input fields in the current ruleset — edit values and click **Run**.
2. **Output tab** — the final response object.
3. **Trace tab** — step-by-step execution log for every node (matched rows, expression results, routed port, console logs, duration).
4. **Context tab** — the full execution context after all nodes have run.
5. After simulation, each node on the canvas is highlighted: **green** = executed, **yellow** = no match, **red** = error, **grey** = skipped.

### Node Highlighting
Simulation results are reflected on the canvas immediately — useful for visually tracing which path through a complex switch/decision tree was taken for a given input.

### GoRules Import / Export
Rulesets can be imported from and exported to the **GoRules JDM format** (`application/vnd.gorules.decision`). Import accepts any `.json` file — the format is detected automatically. Exported files are valid GoRules JDM and can be re-imported into any GoRules-compatible tool.

### Persistent Storage
All rulesets are stored in a **PostgreSQL** database on Railway with a dedicated persistent volume. Data survives redeploys and service restarts.

---

## Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18 + TypeScript | UI framework |
| Build | Vite | Dev server and production bundler |
| Styling | Tailwind CSS | Utility-first CSS |
| Graph canvas | @xyflow/react (ReactFlow v12) | Drag-and-drop node graph |
| Code editor | @monaco-editor/react | JavaScript editing in Function nodes |
| Backend | Node.js + Express | REST API |
| Rule engine | Node.js `vm` module | Sandboxed JS execution for functions/expressions |
| Database | PostgreSQL | Persistent ruleset storage (JSONB) |
| Deploy | Railway | Cloud hosting with auto-deploy |

---

## Local Development

**Prerequisites:** Node.js 18+, a PostgreSQL database

```bash
# Clone
git clone https://github.com/mananaggrawal/brms.git
cd brms

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Configure the database connection
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Start both servers in separate terminals
cd backend && node server.js        # API on :3001
cd frontend && npm run dev          # UI  on :3000
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:3001

---

## Deploying Your Own Instance on Railway

1. **Fork** this repository to your GitHub account.

2. **Create a Railway project** at https://railway.app and connect your GitHub repo.

3. **Add a PostgreSQL database** to the project:
   ```bash
   railway add --database postgres
   ```
   Railway creates a Postgres service with a persistent volume automatically.

4. **Wire the database URL** into your app service as a reference variable:
   ```bash
   railway variables set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --service brms
   ```
   Replace `Postgres` with whatever your Postgres service is named in Railway.

5. **Set the build and start commands** in Railway service settings (or via `railway.toml`):
   - **Build:** `cd backend && npm install && cd ../frontend && npm install && npm run build`
   - **Start:** `cd backend && node server.js`

6. **Deploy:**
   ```bash
   railway up
   ```
   Railway builds the frontend, installs backend deps, and starts the server. The built frontend is served statically by Express on the same port.

7. The app is now live at the Railway-generated domain. Future pushes to `main` trigger automatic redeploys.

**Environment variables used at runtime:**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No (default 3001) | Port the Express server listens on — Railway sets this automatically |

---

## Database Schema

```sql
CREATE TABLE rulesets (
  id   TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
```

The entire ruleset — name, description, status, nodes, edges — is stored as a single JSONB document. This keeps the schema minimal and lets the graph structure evolve without migrations. The table is created automatically on first startup via `CREATE TABLE IF NOT EXISTS`.

---

## Project Structure

```
brms/
├── backend/
│   ├── server.js        # Express REST API + GoRules import/export converter
│   ├── engine.js        # Rule execution engine (DAG traversal, VM sandbox)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Ruleset list, create, import, export
│   │   │   └── GraphEditor.tsx    # Canvas, node editor panel, simulator
│   │   ├── components/
│   │   │   ├── nodes/             # RequestNode, ResponseNode, DecisionTableNode, …
│   │   │   ├── editors/           # DecisionTableEditor, FunctionEditor, …
│   │   │   └── Simulator.tsx      # Bottom-panel simulator UI
│   │   ├── types.ts               # Shared TypeScript types
│   │   └── api.ts                 # Typed API client (fetch wrapper)
│   ├── dist/                      # Built frontend (served by Express in production)
│   └── package.json
└── package.json                   # Root build/start scripts for Railway
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/rulesets` | List all rulesets (summary fields only) |
| `GET` | `/api/rulesets/:id` | Get a single ruleset with full graph data |
| `POST` | `/api/rulesets` | Create a new empty ruleset |
| `PUT` | `/api/rulesets/:id` | Update graph data and/or metadata |
| `DELETE` | `/api/rulesets/:id` | Delete a ruleset |
| `POST` | `/api/rulesets/:id/publish` | Set status to `published` |
| `POST` | `/api/rulesets/:id/duplicate` | Clone a ruleset |
| `POST` | `/api/rulesets/:id/simulate` | Execute ruleset against `{ "input": { … } }` |
| `POST` | `/api/rulesets/import` | Import from our format or GoRules JDM |

---

## Execution Engine

The engine (`backend/engine.js`) executes a ruleset as follows:

1. **Topological sort** — nodes are ordered using Kahn's algorithm (BFS in-degree reduction). Cycles are detected and rejected with an error.
2. **Context initialisation** — a mutable context object is seeded with the JSON input.
3. **Node execution loop** — each node runs in topological order:
   - **Decision table** — evaluates each row's conditions against the context; on match, writes output values back.
   - **Function** — runs user code in a `vm.Script` sandbox; the returned object is deep-merged into context.
   - **Expression** — evaluates a boolean JS expression; writes a true/false value (or custom values) to a named context field.
   - **Switch** — evaluates branch expressions; marks non-matching downstream nodes as skipped.
   - **Response** — snapshots selected fields as the final output.
4. **Trace collection** — every node records its execution result (matched rows, expression value, routed port, logs, duration, context snapshot).
5. **Output** — returns `{ output, context, trace }`.

---

## Building Rulesets from JSON

You can create and import rulesets directly as JSON without using the UI. Use the **Import** button on the Dashboard and upload a `.json` file in either of two formats:

### Our Native Format

```json
{
  "name": "Credit Limit Assessment",
  "description": "Decides credit limit based on bureau data",
  "nodes": [
    {
      "id": "node-request",
      "type": "request",
      "position": { "x": 60, "y": 200 },
      "data": { "label": "Request" }
    },
    {
      "id": "dt-1",
      "type": "decisionTable",
      "position": { "x": 300, "y": 150 },
      "data": {
        "label": "Credit Score Check",
        "hitPolicy": "first",
        "inputs": [
          { "field": "creditScore", "label": "Credit Score" }
        ],
        "outputs": [
          { "field": "creditBand", "label": "Credit Band" }
        ],
        "rows": [
          {
            "id": "row-1",
            "conditions": [{ "expression": ">= 750" }],
            "outputs":    [{ "value": "\"prime\"" }]
          },
          {
            "id": "row-2",
            "conditions": [{ "expression": ">= 600" }],
            "outputs":    [{ "value": "\"near-prime\"" }]
          },
          {
            "id": "row-3",
            "conditions": [{ "expression": "" }],
            "outputs":    [{ "value": "\"subprime\"" }]
          }
        ]
      }
    },
    {
      "id": "node-response",
      "type": "response",
      "position": { "x": 700, "y": 200 },
      "data": {
        "label": "Response",
        "outputFields": [
          { "field": "creditBand", "label": "Credit Band" }
        ]
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "node-request", "target": "dt-1" },
    { "id": "e2", "source": "dt-1",         "target": "node-response" }
  ]
}
```

### Node Type Reference for JSON

**`request`** — entry point, no extra fields required.

**`response`** — collects output fields:
```json
{
  "type": "response",
  "data": {
    "label": "Response",
    "outputFields": [
      { "field": "result.decision", "label": "Decision" }
    ]
  }
}
```

**`decisionTable`** — tabular rules:
```json
{
  "type": "decisionTable",
  "data": {
    "label": "My Table",
    "hitPolicy": "first",
    "inputs":  [{ "field": "income",    "label": "Income" }],
    "outputs": [{ "field": "eligible",  "label": "Eligible" }],
    "rows": [
      { "id": "r1", "conditions": [{ "expression": ">= 50000" }], "outputs": [{ "value": "true" }] },
      { "id": "r2", "conditions": [{ "expression": "" }],          "outputs": [{ "value": "false" }] }
    ]
  }
}
```

**`function`** — JavaScript node:
```json
{
  "type": "function",
  "data": {
    "label": "Compute DTI",
    "code": "const handler = (input) => ({ dti: input.debt / input.income });"
  }
}
```

**`expression`** — boolean → field value:
```json
{
  "type": "expression",
  "data": {
    "label": "High Risk Flag",
    "expression": "input.creditScore < 600 && input.dti > 0.5",
    "outputField": "isHighRisk",
    "trueValue":  "true",
    "falseValue": "false"
  }
}
```

**`switch`** — conditional branching:
```json
{
  "type": "switch",
  "data": {
    "label": "Route by Band",
    "hitPolicy": "first",
    "branches": [
      { "id": "b1", "label": "If",      "expression": "input.creditBand === 'prime'",      "port": "b1" },
      { "id": "b2", "label": "Else If", "expression": "input.creditBand === 'near-prime'", "port": "b2" },
      { "id": "b3", "label": "Else",    "expression": "",                                  "port": "b3", "isElse": true }
    ]
  }
}
```

**Edges with switch ports** — use `sourceHandle` to target a specific branch:
```json
{ "id": "e1", "source": "switch-1", "target": "prime-table",      "sourceHandle": "b1" },
{ "id": "e2", "source": "switch-1", "target": "near-prime-table",  "sourceHandle": "b2" },
{ "id": "e3", "source": "switch-1", "target": "fallback-table",    "sourceHandle": "b3" }
```

### GoRules JDM Format

Files with `"contentType": "application/vnd.gorules.decision"` are automatically detected and converted on import. You do not need to pre-process them.

---

## GoRules Compatibility

| Feature | Supported |
|---|---|
| Import GoRules JDM (`application/vnd.gorules.decision`) | ✅ |
| Export to GoRules JDM | ✅ |
| Decision tables (inputs, outputs, rules) | ✅ |
| Function nodes | ✅ |
| Switch nodes (statements → branches) | ✅ |
| Expression nodes | ✅ |
| Input / Output nodes | ✅ |
