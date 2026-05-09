# BRMS — Business Rules Management System

A visual, graph-based rule engine for building and simulating decision flows — inspired by GoRules/Bureau.

**Live:** https://brms-production.up.railway.app

---

## Features

- **Visual Graph Editor** — drag-and-drop nodes connected by edges
- **Decision Tables** — inline expression conditions (`>= 750`, `false`, `"accept"`) with hit policies (First / All / Collect)
- **Function Nodes** — full JavaScript editor with Monaco
- **Expression Nodes** — boolean expressions that write to context fields
- **Switch Nodes** — conditional routing with If / Else If / Else branches
- **Simulator** — run JSON input through the ruleset, see output, execution trace, and full context
- **Node Highlighting** — after simulation, nodes are highlighted green/yellow/red based on execution result
- **GoRules Import/Export** — compatible with `application/vnd.gorules.decision` format

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Graph Canvas | @xyflow/react (ReactFlow v12) |
| Code Editor | @monaco-editor/react |
| Backend | Node.js, Express |
| Storage | File-based JSON |
| Deploy | Railway |

---

## Local Development

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start both servers
./start.sh
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## Project Structure

```
brms/
├── backend/
│   ├── server.js        # Express API + GoRules import converter
│   ├── engine.js        # Rule execution engine (topological sort, VM sandbox)
│   └── data/            # JSON file storage (gitignored)
├── frontend/
│   ├── src/
│   │   ├── pages/       # Dashboard, GraphEditor
│   │   ├── components/  # Nodes, editors, Simulator
│   │   ├── types.ts     # Shared TypeScript types
│   │   └── api.ts       # Backend API client
│   └── dist/            # Built frontend (served by Express in production)
└── package.json         # Root build/start scripts for Railway
```

---

## GoRules Compatibility

Rulesets can be imported from and exported to the GoRules JDM format (`application/vnd.gorules.decision`). Use the **Import** button on the dashboard or **Export** inside a ruleset.
