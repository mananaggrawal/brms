---
title: "BRMS — Business Rules Management System"
subtitle: "Technical Architecture & User Guide"
author: "VegaPay Technology"
date: "2026"
---

# 1. Introduction

## 1.1 What Is BRMS?

BRMS (Business Rules Management System) is a full-stack web application that lets teams build, manage, and execute complex business logic as **visual decision graphs** — without writing application code. Rules are modelled as directed acyclic graphs (DAGs) of typed nodes, each representing a distinct computation step such as a decision table, a JavaScript function, a boolean expression, or a conditional router.

Typical use-cases at a fintech or lending company include:

- **Credit decisioning** — approve / reject / refer based on bureau scores, income, and exposure
- **Limit assignment** — compute a credit or overdraft limit from multiple risk signals
- **Fraud scoring** — combine signals from multiple checks and produce a risk rating
- **Eligibility checks** — evaluate product or feature eligibility against customer attributes
- **Policy enforcement** — encode and version underwriting policies without engineering intervention

## 1.2 Key Design Goals

| Goal | How It Is Achieved |
|---|---|
| No-code rule authoring | Drag-and-drop visual graph editor |
| Safe, sandboxed execution | Node.js `vm` module for all JS evaluation |
| Versioned, persistent rules | PostgreSQL with JSONB storage |
| Test-before-publish workflow | Built-in simulator with trace and node highlighting |
| Interoperability | GoRules JDM import/export |
| Zero-downtime iteration | Draft / Published status lifecycle |

---

# 2. Technology Stack

## 2.1 Frontend

### React 18 + TypeScript
The entire UI is written in React 18 with strict TypeScript. React's component model maps naturally to the graph canvas — each node type is an independent React component that receives its data as props and emits changes upward.

TypeScript enforces shape contracts across the codebase (see `frontend/src/types.ts`). Every node data type — `DecisionTableData`, `FunctionData`, `SwitchData`, etc. — is explicitly typed, preventing the class of runtime crashes that come from loosely-typed node data.

### Vite
Vite is the build tool and dev server. It uses native ES modules during development (no bundling step, sub-100 ms hot module replacement) and Rollup for production builds. The production build outputs to `frontend/dist/`, which Express serves as static files in production.

### Tailwind CSS
Tailwind provides utility classes for all styling. No custom CSS files exist in the project. The design system uses Tailwind's `slate` palette for neutrals, with `brand-500` (`#4f6ef7`) as the accent colour (defined in `tailwind.config.js`).

### @xyflow/react (ReactFlow v12)
ReactFlow provides the interactive graph canvas. It manages:
- Node positions and drag behaviour
- Edge drawing and connection validation
- Zoom, pan, and minimap
- Custom node and edge renderers

Each node type is registered as a custom node component. ReactFlow's `useNodesState` and `useEdgesState` hooks hold the live graph state; changes flow into the debounced auto-save loop.

### @monaco-editor/react
Monaco Editor (the same engine as VS Code) is embedded in two places:

- **Function node editor** — JavaScript with syntax highlighting, auto-completion, and error markers.
- **Simulator input panel** — JSON editor for crafting test inputs.

All Monaco instances use a consistent `vs-dark` theme. Because Monaco exposes a single global theme state, mixing light and dark themes across instances causes erratic flickering; keeping them uniform eliminates this. Both panels also call `stopPropagation` on `keydown` events so that ReactFlow's global keyboard shortcuts (Space for pan, Delete for node removal) do not interfere with typing inside Monaco.

---

## 2.2 Backend

### Node.js + Express
The backend is a single Express application (`backend/server.js`). It:
- Serves the REST API on `/api/*`
- Serves the built React frontend as static files in production
- Handles GoRules JDM format conversion on import

Express was chosen for its minimal surface area. There are no ORM layers, no middleware frameworks — just straightforward route handlers with async/await.

### Rule Execution Engine (`backend/engine.js`)
The engine is a pure Node.js module with no external dependencies. It receives a ruleset object and an input object, executes the DAG, and returns `{ output, context, trace }`. The implementation is covered in full in Section 4.

### Node.js `vm` Module
All user-provided JavaScript (Function nodes, Expression nodes, Switch branch conditions) is executed inside a `vm.Script` sandbox. The sandbox is given a controlled set of globals (`Math`, `JSON`, `Date`, `parseInt`, etc.) and a deep copy of the execution context. It has no access to the file system, network, or `require`. This prevents malicious or buggy rule code from affecting the server process.

---

## 2.3 Database

### PostgreSQL
Rulesets are stored in a single PostgreSQL table:

```sql
CREATE TABLE rulesets (
  id   TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
```

The entire ruleset — metadata, node graph, and all edge connections — is stored as a single JSONB document per row. This design means:

- **No migrations required** as the graph schema evolves — JSONB is schemaless within the column
- **Simple upserts** — `INSERT … ON CONFLICT DO UPDATE SET data = $2`
- **Efficient reads** — fetching a single ruleset is a single-row lookup by primary key

The `pg` npm package provides the database connection via a connection pool (`Pool`). The connection string is taken from the `DATABASE_URL` environment variable.

### Railway PostgreSQL
In production, Railway provisions a managed PostgreSQL 15 instance with a dedicated persistent volume. Unlike Railway's ephemeral filesystem (which gets wiped on every redeploy), the volume survives all deployments, restarts, and service updates.

---

## 2.4 Infrastructure & Deployment

### Railway
Railway is the cloud hosting platform. The project contains two Railway services:

| Service | Purpose |
|---|---|
| `brms` | Node.js Express app (frontend + backend) |
| `Postgres-wPYD` | Managed PostgreSQL 15 with persistent volume |

The `DATABASE_URL` in the `brms` service is a **reference variable** that points to the Postgres service's connection string — Railway resolves it at deploy time. This means no secrets are hardcoded.

### Build and Deploy Process
1. Developer pushes to `main` on GitHub.
2. Railway detects the push and triggers a build using the root `package.json` build script:
   ```
   cd backend && npm install && cd ../frontend && npm install && npm run build
   ```
3. The frontend is compiled to `frontend/dist/`.
4. Railway starts the server: `cd backend && node server.js`.
5. Express serves both the API and the static frontend on the same port.

### Zero-Downtime Deploys
Railway drains existing connections before switching to the new deployment. The PostgreSQL service is independent of the app service, so database state is never affected by app redeploys.

---

# 3. Application Architecture

## 3.1 High-Level Data Flow

```
Browser
  │
  │  HTTP/JSON REST  (fetch via api.ts)
  ▼
Express  (/api/*)
  │
  ├─ CRUD routes ──────────► PostgreSQL  (pg Pool, JSONB)
  │
  └─ /simulate ────────────► engine.js
                                │
                                ├─ topologicalSort()
                                ├─ executeDecisionTable()
                                ├─ executeFunction()    ──► vm.Script sandbox
                                ├─ executeExpression()  ──► vm.Script sandbox
                                ├─ executeSwitch()      ──► vm.Script sandbox
                                └─ returns { output, context, trace }
```

## 3.2 Frontend Component Hierarchy

```
App.tsx (ErrorBoundary + Router)
├── Dashboard.tsx
│   ├── Ruleset cards (list)
│   ├── Create / Import / Export controls
│   └── Search filter
└── GraphEditor.tsx
    ├── ReactFlow canvas
    │   ├── RequestNode
    │   ├── ResponseNode
    │   ├── DecisionTableNode
    │   ├── FunctionNode
    │   ├── ExpressionNode
    │   └── SwitchNode
    ├── Node editor panel (right)
    │   ├── DecisionTableEditor
    │   ├── FunctionEditor
    │   ├── ExpressionEditor
    │   ├── SwitchEditor
    │   └── RequestEditor / ResponseEditor
    └── Simulator panel (bottom)
        └── Simulator.tsx
            ├── Monaco Editor (input JSON)
            ├── Output tab
            ├── Trace tab
            └── Context tab
```

## 3.3 Auto-Save Mechanism

Every change to the graph (node moved, edge added, editor content changed) calls `scheduleSave()`, which sets a 1500 ms debounce timer. When the timer fires, `doSave()` sends a `PUT /api/rulesets/:id` request with the current nodes and edges serialised from the ReactFlow state. A "Saved / Unsaved" indicator in the toolbar reflects the pending state.

A `nodesRef` / `edgesRef` pattern ensures the debounced callback always captures the latest state even across multiple React re-renders within the debounce window.

## 3.4 Ruleset Lifecycle

```
Draft ──[Publish]──► Published
  ▲                      │
  └────[Duplicate]───────┘
         (new Draft)
```

Rulesets start as `draft`. Clicking **Publish** sets status to `published`. Duplicating a published ruleset creates a fresh `draft` copy. There is no revert — if you need to modify a published ruleset, duplicate it, edit the copy, and republish.

---

# 4. Rule Execution Engine

## 4.1 Overview

The engine (`backend/engine.js`) is a self-contained module. It takes a ruleset object (nodes + edges) and an input object, executes the graph, and returns a result. It has no I/O side effects and no external dependencies beyond Node.js built-ins.

## 4.2 Topological Sort

Rulesets are DAGs. Before execution, nodes are sorted topologically using **Kahn's algorithm**:

1. Compute in-degree (number of incoming edges) for every node.
2. Initialise a queue with all nodes of in-degree 0.
3. Repeatedly dequeue a node, append it to the sorted list, and decrement the in-degree of its successors; enqueue any that reach in-degree 0.
4. If the sorted list is shorter than the node list, a cycle exists — throw an error.

This guarantees that when a node executes, all its upstream dependencies have already run and written their values into the shared context.

## 4.3 Execution Context

The context is a plain JavaScript object seeded from the request input:

```js
const context = JSON.parse(JSON.stringify(input));
```

Each node reads from and writes to this context using dot-notation field paths (e.g., `customer.creditScore`). Helper functions `getNestedValue` and `setNestedValue` traverse and mutate the object by splitting paths on `.`.

## 4.4 Node Execution

### Decision Table

For each row in the table, every input column's condition is evaluated against the corresponding context field. The condition expression parser supports:

| Syntax | Example | Meaning |
|---|---|---|
| Operator + value | `>= 750` | Numeric comparison |
| Equality | `"prime"` | String equality |
| Boolean | `true` / `false` | Boolean match |
| Null | `null` | Null check |
| Empty check | `is_empty` | Field is absent or blank |
| Wildcard | *(blank)* | Always matches |
| Full expression | `customer.age > 25` | Field path + operator + value |
| Compound range | `>= 25000 and <= 200000` | Two conditions joined with `and` |

On a match, output column values are written back to the context via `setNestedValue`. The **hit policy** controls how many rows are processed: `first` stops after the first match; `all` and `collect` continue through all rows.

**GoRules JDM compatibility notes** — when importing GoRules decision tables, the engine transparently handles three quirks:

1. **Numeric underscore separators** — GoRules allows `25_000`; the engine strips underscores before numeric comparison (`Number('25_000')` returns `NaN` in native JS).
2. **Compound `and` ranges** — expressions like `>= 25_000 and <= 200_000` are split on ` and ` and both sub-expressions must match.
3. **Field-path output values** — if an output cell contains a bare identifier like `card_variant.limit`, the engine resolves it as a field reference from the context rather than treating it as a literal string.

### Function Node

User code is wrapped in a harness and run inside a `vm.Script`:

```js
const sandbox = {
  __input: deepCopy(context),
  __result: Promise.resolve({}),
  console: { log: ..., error: ..., warn: ... },
  Math, JSON, Date, parseInt, parseFloat, isNaN,
  Number, String, Boolean, Array, Object, Promise,
};
vm.createContext(sandbox);
new vm.Script(wrappedCode).runInContext(sandbox);
const result = await sandbox.__result;
deepMerge(context, result);
```

The function receives the context as `input` and returns an object. That object is deep-merged back into the context. Console output is captured and surfaced both in the simulator trace and in the inline **Console** panel at the bottom of the Function node editor. Objects and arrays passed to `console.log()` are serialised with `JSON.stringify` so that `[object Object]` is never shown.

### Expression Node

A boolean expression is evaluated with the context available as `input`:

```js
new vm.Script(`__result = !!(${expression})`).runInContext(sandbox);
const value = sandbox.__result ? trueValue : falseValue;
setNestedValue(context, outputField, value);
```

The result and the written value appear in the simulator trace.

### Switch Node

Each branch expression is evaluated in the same sandboxed manner. Branches that do not match have their downstream nodes added to a `skippedNodes` set. The execution loop skips any node whose ID is in this set, marking it as `skipped` in the trace. This implements conditional routing through the graph.

### Response Node

The response node does not mutate the context. It reads `outputFields` from its configuration and extracts those paths from the context to form the final `output` object. If no output fields are configured, the entire context is returned as output.

## 4.5 Trace Output

Every executed node produces a trace entry:

```json
{
  "nodeId": "dt-1",
  "nodeType": "decisionTable",
  "nodeLabel": "Credit Score Check",
  "matchedRows": [
    { "rowId": "row-1", "outputs": { "creditBand": "prime" } }
  ],
  "contextSnapshot": { "creditScore": 780, "creditBand": "prime" },
  "duration": 2
}
```

The simulator displays this trace as an expandable list, with matched rows, expression values, routed ports, console logs, and context snapshots visible per node.

---

# 5. API Reference

All endpoints are prefixed `/api`. Request and response bodies are JSON.

## 5.1 List Rulesets
**`GET /api/rulesets`**

Returns a summary array. Does not include node/edge data.

```json
[
  {
    "id": "uuid",
    "name": "Credit Limit Assessment",
    "description": "...",
    "status": "published",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-02T00:00:00.000Z",
    "nodeCount": 5
  }
]
```

## 5.2 Get Ruleset
**`GET /api/rulesets/:id`**

Returns the full ruleset including all nodes and edges.

## 5.3 Create Ruleset
**`POST /api/rulesets`**

Body: `{ "name": "...", "description": "..." }`

Creates a new draft ruleset with a default Request + Response node pair.

## 5.4 Update Ruleset
**`PUT /api/rulesets/:id`**

Body: partial ruleset object. Merges into the existing record and updates `updatedAt`.

## 5.5 Simulate
**`POST /api/rulesets/:id/simulate`**

```json
// Request
{ "input": { "creditScore": 720, "income": 80000 } }

// Response
{
  "output":  { "creditBand": "prime", "eligible": true },
  "context": { "creditScore": 720, "income": 80000, "creditBand": "prime", "eligible": true },
  "trace":   [ … ]
}
```

## 5.6 Import
**`POST /api/rulesets/import`**

Accepts both native format (with a `name` field) and GoRules JDM format (detected via `contentType: "application/vnd.gorules.decision"`). Returns the created ruleset.

---

# 6. Data Formats

## 6.1 Native Ruleset JSON

The canonical format used by the API and export:

```json
{
  "id": "uuid",
  "name": "My Ruleset",
  "description": "...",
  "status": "draft",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "nodes": [ … ],
  "edges": [ … ]
}
```

### Node Shape

Every node shares a common envelope:

```json
{
  "id": "unique-string",
  "type": "request | response | decisionTable | function | expression | switch",
  "position": { "x": 100, "y": 200 },
  "data": { … type-specific … }
}
```

### Edge Shape

```json
{
  "id": "unique-string",
  "source": "node-id",
  "target": "node-id",
  "sourceHandle": "branch-port-id-or-null",
  "targetHandle": null
}
```

`sourceHandle` is only set on edges leaving a Switch node — it identifies which branch port the edge is attached to.

## 6.2 GoRules JDM Format

GoRules files use `"contentType": "application/vnd.gorules.decision"` and different type names and edge field names. The server's `convertFromGoRules()` function handles the mapping:

| GoRules type | BRMS type |
|---|---|
| `inputNode` | `request` |
| `outputNode` | `response` |
| `decisionTableNode` | `decisionTable` |
| `functionNode` | `function` |
| `switchNode` | `switch` |
| `expressionNode` | `expression` |

GoRules edges use `sourceId`/`targetId`; BRMS uses `source`/`target`. Switch nodes use `content.statements[{id, condition, isDefault}]`; BRMS uses `data.branches[{id, label, expression, port, isElse}]`.

---

# 7. Building Rulesets in JSON

You can construct and upload rulesets directly as JSON files without using the visual editor. This is useful for bulk migration, version-controlled rules, or programmatic rule generation.

## 7.1 Minimal Ruleset

```json
{
  "name": "Simple Credit Check",
  "nodes": [
    {
      "id": "req", "type": "request",
      "position": { "x": 60, "y": 200 },
      "data": { "label": "Request" }
    },
    {
      "id": "dt1", "type": "decisionTable",
      "position": { "x": 300, "y": 150 },
      "data": {
        "label": "Credit Score Band",
        "hitPolicy": "first",
        "inputs":  [{ "field": "creditScore", "label": "Credit Score" }],
        "outputs": [{ "field": "band",         "label": "Band" }],
        "rows": [
          { "id": "r1", "conditions": [{ "expression": ">= 750" }], "outputs": [{ "value": "\"prime\""      }] },
          { "id": "r2", "conditions": [{ "expression": ">= 600" }], "outputs": [{ "value": "\"near-prime\"" }] },
          { "id": "r3", "conditions": [{ "expression": ""       }], "outputs": [{ "value": "\"subprime\""   }] }
        ]
      }
    },
    {
      "id": "res", "type": "response",
      "position": { "x": 600, "y": 200 },
      "data": {
        "label": "Response",
        "outputFields": [{ "field": "band", "label": "Band" }]
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "req", "target": "dt1" },
    { "id": "e2", "source": "dt1", "target": "res" }
  ]
}
```

## 7.2 Multi-Node Ruleset with Switch

```json
{
  "name": "Tiered Limit Assignment",
  "nodes": [
    { "id": "req", "type": "request",  "position": { "x": 60,  "y": 300 }, "data": { "label": "Request" } },
    {
      "id": "sw1", "type": "switch", "position": { "x": 280, "y": 280 },
      "data": {
        "label": "Route by Band",
        "hitPolicy": "first",
        "branches": [
          { "id": "b1", "label": "If",      "expression": "input.band === 'prime'",      "port": "b1" },
          { "id": "b2", "label": "Else If", "expression": "input.band === 'near-prime'", "port": "b2" },
          { "id": "b3", "label": "Else",    "expression": "",                            "port": "b3", "isElse": true }
        ]
      }
    },
    {
      "id": "dt-prime", "type": "decisionTable", "position": { "x": 560, "y": 100 },
      "data": {
        "label": "Prime Limits",
        "hitPolicy": "first",
        "inputs":  [{ "field": "income", "label": "Income" }],
        "outputs": [{ "field": "limit",  "label": "Limit" }],
        "rows": [
          { "id": "r1", "conditions": [{ "expression": ">= 200000" }], "outputs": [{ "value": "500000" }] },
          { "id": "r2", "conditions": [{ "expression": "" }],          "outputs": [{ "value": "250000" }] }
        ]
      }
    },
    {
      "id": "dt-np", "type": "decisionTable", "position": { "x": 560, "y": 300 },
      "data": {
        "label": "Near-Prime Limits",
        "hitPolicy": "first",
        "inputs":  [{ "field": "income", "label": "Income" }],
        "outputs": [{ "field": "limit",  "label": "Limit" }],
        "rows": [
          { "id": "r1", "conditions": [{ "expression": "" }], "outputs": [{ "value": "100000" }] }
        ]
      }
    },
    {
      "id": "dt-sub", "type": "decisionTable", "position": { "x": 560, "y": 500 },
      "data": {
        "label": "Subprime Limits",
        "hitPolicy": "first",
        "inputs":  [{ "field": "income", "label": "Income" }],
        "outputs": [{ "field": "limit",  "label": "Limit" }],
        "rows": [
          { "id": "r1", "conditions": [{ "expression": "" }], "outputs": [{ "value": "25000" }] }
        ]
      }
    },
    { "id": "res", "type": "response", "position": { "x": 850, "y": 300 }, "data": { "label": "Response", "outputFields": [{ "field": "limit", "label": "Limit" }] } }
  ],
  "edges": [
    { "id": "e1", "source": "req",      "target": "sw1" },
    { "id": "e2", "source": "sw1",      "target": "dt-prime", "sourceHandle": "b1" },
    { "id": "e3", "source": "sw1",      "target": "dt-np",    "sourceHandle": "b2" },
    { "id": "e4", "source": "sw1",      "target": "dt-sub",   "sourceHandle": "b3" },
    { "id": "e5", "source": "dt-prime", "target": "res" },
    { "id": "e6", "source": "dt-np",    "target": "res" },
    { "id": "e7", "source": "dt-sub",   "target": "res" }
  ]
}
```

## 7.3 Uploading

Go to the **Dashboard**, click **Import**, and select the `.json` file. The ruleset name is taken from the `name` field in the JSON (or from the filename if no `name` is present). The ruleset will appear as a `draft` card and can be opened in the visual editor immediately.

---

# 8. Security Considerations

| Area | Approach |
|---|---|
| User code execution | `vm.Script` sandbox with no file system or network access |
| Sandbox globals | Whitelist only: `Math`, `JSON`, `Date`, `parseInt`, `parseFloat`, `isNaN`, `Number`, `String`, `Boolean`, `Array`, `Object`, `Promise`, `console` |
| Context isolation | Deep copy of context passed into sandbox — mutations inside sandbox do not affect the live context object directly |
| SQL injection | Parameterised queries only (`$1`, `$2`) — no string concatenation in SQL |
| Input size | Express body parser limited to 50 MB |
| CORS | Enabled globally — restrict to your domain in production if needed |

---

# 9. Extending BRMS

## 9.1 Adding a New Node Type

1. Define the data interface in `frontend/src/types.ts` and add the type to `NodeType`.
2. Create a node component in `frontend/src/components/nodes/`.
3. Register the component in `nodeTypes` in `GraphEditor.tsx`.
4. Create an editor component in `frontend/src/components/editors/`.
5. Add the editor case to `GraphEditor.tsx`'s node editor panel.
6. Add an execution handler in `backend/engine.js`.
7. Update the GoRules converter in `backend/server.js` if interoperability is needed.

## 9.2 Connecting to an External API

Add a new route to `server.js` or call an external service from within a Function node (note: the `vm` sandbox does not have `fetch` — call external APIs from an Express route and pass results in through the simulate endpoint's input).

## 9.3 Multi-Tenancy

The current schema has no tenant column. To support multiple tenants, add a `tenant_id TEXT` column to the `rulesets` table and filter all queries by it. Pass the tenant identifier via a request header or JWT claim.
