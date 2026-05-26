# AgentMesh — AI Agent Orchestration Platform

AgentMesh is a fully local, production-oriented platform for building, configuring, and running multi-agent AI workflows. Users create agents with custom roles, tools, memory, and guardrails, connect them into visual workflows, trigger them from a REST API or Telegram, and watch every execution in real time — including logs, inter-agent messages, token counts, and cost.

---

## Features

| Category | What's included |
|---|---|
| **Agents** | CRUD with name, role, system prompt, model, tools, memory, guardrails, schedule, channel, and per-agent API key |
| **Models** | Google Gemini (free tier), OpenAI GPT, Anthropic Claude — switchable per agent |
| **Tools** | 18 built-in tools: web search, webpage extraction, HTTP requests, RSS reader, file I/O, Python REPL, email, image analysis, Redis notes, date/time, and more |
| **Workflows** | Visual ReactFlow builder with agent nodes, condition nodes, feedback loops, and 2 pre-built templates |
| **Execution** | LangGraph runtime with real LLM calls, tool use, and async graph streaming |
| **Memory** | Per-agent buffer window or summary memory with configurable size |
| **Guardrails** | Max tokens per run, max cost (USD), forbidden topics |
| **Scheduling** | Celery worker executes agents on cron schedules |
| **Channels** | Telegram webhook: workflow selection menu, inline buttons, inbound/outbound messages |
| **Monitoring** | Real-time WebSocket log stream, inter-agent message events, per-agent token and cost breakdown |
| **Persistence** | PostgreSQL for agents, workflows, executions, logs, and messages; Redis for pub/sub and Celery |

---

## Architecture

```mermaid
flowchart LR
    Telegram[Telegram\nWebhook] -->|inbound message| FastAPI
    React[React + ReactFlow\nWeb UI] -->|REST / WebSocket| FastAPI

    subgraph FastAPI[FastAPI Backend]
        API[REST API\n/api/*]
        WS[WebSocket\n/ws/executions/*/logs]
        Webhook["/webhook/telegram"]
    end

    FastAPI -->|async sessions| PostgreSQL[(PostgreSQL\nAgents · Workflows\nExecutions · Logs · Messages)]
    FastAPI -->|publish events| Redis[(Redis\nPub/Sub · Celery Broker\nAgent Notes)]
    Redis --> WS
    FastAPI -->|background task| Runtime

    subgraph Runtime[LangGraph Runtime]
        Executor[executor.py\nWorkflow runner]
        GraphBuilder[graph_builder.py\nDynamic compilation]
        AgentNode[agent_node.py\nLLM + Tools + Memory]
        Executor --> GraphBuilder --> AgentNode
        AgentNode -->|delegate_to_agent| AgentNode
    end

    AgentNode -->|LLM calls| OpenAI[OpenAI GPT]
    AgentNode -->|LLM calls| Gemini[Google Gemini]
    AgentNode -->|LLM calls| Anthropic[Anthropic Claude]
    Runtime -->|persist logs & messages| PostgreSQL
    Runtime -->|stream events| Redis
    Runtime -->|reply| Telegram
```

**Request path (Telegram example):**
`Telegram → FastAPI Webhook → PostgreSQL (inbound message) → LangGraph Runtime → Agent Nodes (LLM + Tools) → PostgreSQL (logs, outbound message) → Redis → WebSocket → React UI`

---

## Why LangGraph

LangGraph was chosen because:

- **Stateful graph execution** — workflow graphs stored as JSON in PostgreSQL are compiled at runtime into real LangGraph `StateGraph` objects; no hardcoded pipelines.
- **Native async streaming** — `graph.astream()` yields updates that are forwarded over Redis pub/sub to the browser WebSocket in real time.
- **Conditional edges and feedback loops** — condition nodes with arbitrary expressions map directly to LangGraph's `add_conditional_edges` API, enabling branching and revision loops without extra framework overhead.
- **First-class tool calling** — `create_tool_calling_agent` + `AgentExecutor` handle the full LangChain tool-use loop, including intermediate steps for log visibility.

---

## Why FastAPI + React

**FastAPI** keeps the backend async-native end-to-end: SQLAlchemy async sessions, Redis async client, async LangGraph streaming, and async Telegram bot — all in one event loop with no blocking. Pydantic schemas provide strict validation and auto-generated OpenAPI docs at `/docs`.

**React + TypeScript** gives strong frontend contracts via typed API clients, ergonomic server state management with React Query, and a natural canvas through ReactFlow. Tailwind CSS keeps the UI consistent without a heavy component library.

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- A Google AI Studio API key (free) — **or** an OpenAI / Anthropic key

### 1 — Clone and configure

```bash
git clone <your-repo-url>
cd ai-orchestration-platform
cp .env.example .env
```

Open `.env` and fill in at least one model key:

```env
# Pick at least one — Gemini is free
GEMINI_API_KEY=AIza...              # Google AI Studio (free tier)
OPENAI_API_KEY=sk-...              # Optional
ANTHROPIC_API_KEY=sk-ant-...       # Optional

# Telegram (optional — needed for bot integration)
TELEGRAM_BOT_TOKEN=123456:ABC...
```

### 2 — Start everything

```bash
docker compose up --build
```

On first boot Docker will:
1. Start PostgreSQL and Redis
2. Run Alembic migrations
3. Seed 2 workflow templates and 8 demo agents
4. Start the FastAPI backend on **port 8000**
5. Serve the React frontend on **port 3000**

Open **http://localhost:3000** to access the UI.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | One of these three | Google AI Studio key for Gemini models (free tier) |
| `OPENAI_API_KEY` | One of these three | OpenAI key for GPT models |
| `ANTHROPIC_API_KEY` | One of these three | Anthropic key for Claude models |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables Telegram channel integration |
| `TAVILY_API_KEY` | Optional | More reliable web search (free at app.tavily.com) |
| `DEFAULT_SUMMARY_MODEL` | Optional | Model used by the summarize_text tool (default: `gemini-2.5-flash`) |
| `SMTP_HOST` | Optional | SMTP server for the send_email tool |
| `SMTP_PORT` | Optional | SMTP port (default: 587) |
| `SMTP_USER` | Optional | SMTP login username |
| `SMTP_PASSWORD` | Optional | SMTP login password |
| `SMTP_FROM` | Optional | From address for outgoing email |
| `PUBLIC_BASE_URL` | Optional | Public URL for Telegram webhook registration |

---

## Models Supported

### Google Gemini — Free Tier

| Model | Notes |
|---|---|
| `gemini-2.5-flash` | Default — fastest, free via Google AI Studio |
| `gemini-2.0-flash` | Multimodal, free tier |
| `gemini-1.5-flash-8b` | Lightest, free tier |
| `gemma-4-31b-it` | Open-weights Gemma via Gemini API, free tier |

Gemini usage is tracked as `$0.00` in the cost table. Rate limits apply on Google's side.

### OpenAI

| Model | Input / 1K tokens | Output / 1K tokens |
|---|---|---|
| `gpt-4o` | $0.005 | $0.015 |
| `gpt-4o-mini` | $0.00015 | $0.0006 |

### Anthropic Claude

| Model | Input / 1K tokens | Output / 1K tokens |
|---|---|---|
| `claude-opus-4-7` | $0.015 | $0.075 |
| `claude-sonnet-4-6` | $0.003 | $0.015 |
| `claude-haiku-4-5` | $0.0008 | $0.004 |

### Per-Agent API Keys

Each agent can store its own API key, overriding the server-level environment variable. This lets different agents use different accounts or billing buckets. Keys are stored encrypted-at-rest in the database and are never returned by the API.

---

## Built-in Tools (18)

| Group | Tool | Description |
|---|---|---|
| **Web & Data** | `web_search` | DuckDuckGo / Tavily search |
| | `extract_webpage` | Fetch and clean readable text from any URL |
| | `http_request` | Make arbitrary REST/HTTP calls |
| | `rss_reader` | Parse RSS 2.0 and Atom feeds |
| **AI & Analysis** | `summarize_text` | Condense long text with the configured LLM |
| | `analyze_image` | Describe or question an image URL using a vision model |
| **Files & Code** | `read_file` | Read a file from `/workspace` |
| | `write_file` | Write a file to `/workspace` |
| | `list_files` | Browse `/workspace` directory |
| | `python_repl` | Execute Python code in a sandboxed subprocess |
| **Memory & Notes** | `save_note` | Persist a named note in Redis (7-day TTL) |
| | `get_note` | Retrieve a previously saved note |
| **Utilities** | `get_datetime` | Current date, time, and timezone info |
| | `send_email` | Send email via SMTP (requires SMTP config) |
| | `send_telegram_message` | Send a Telegram message to a chat ID |
| **Workflow** | `delegate_to_agent` | Route a task to another agent and return its response |
| | `request_human_input` | Pause the workflow and ask the user a question |
| | `summarize_text` | _(also listed above)_ |

---

## Workflow Templates

Two templates are seeded automatically on first startup:

### 1. Customer Support Pipeline
```
Start → Triage Agent
          ├─[billing]──→ Billing Specialist → Response Agent → End
          └─[technical]→ Technical Specialist → Response Agent → End
```

### 2. Research & Report Generator
```
Start → Research Agent → Analysis Agent → Writing Agent → Review Agent
                                                    ↑              |
                                                    └──[revise]────┘
                                                           |
                                                        [good]
                                                           ↓
                                                          End
```

---

## Telegram Integration

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Expose your backend publicly (ngrok, Cloudflare Tunnel, etc.) and set `PUBLIC_BASE_URL`.
3. In the Settings page, paste your public URL and click **Register Webhook**.
4. Message your bot on Telegram — it will present a workflow selection menu.

**Supported commands:**

| Command | Effect |
|---|---|
| `/start` | Shows workflow selection menu |
| `/workflows` | Switch to a different workflow |
| `/help` | Lists available commands |
| _(any message)_ | Runs the selected workflow with your message as input |

---

## API Reference

### Agents
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agents` | Create an agent |
| `GET` | `/api/agents` | List all agents |
| `GET` | `/api/agents/{id}` | Get an agent |
| `PUT` | `/api/agents/{id}` | Update an agent |
| `DELETE` | `/api/agents/{id}` | Delete an agent |
| `POST` | `/api/agents/{id}/test` | Chat with an agent (with tool execution) |
| `POST` | `/api/agents/orchestrator` | Auto-create an Orchestrator agent |

### Workflows
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/workflows` | Create a workflow |
| `GET` | `/api/workflows` | List workflows |
| `GET` | `/api/workflows/templates` | List template workflows |
| `GET` | `/api/workflows/{id}` | Get a workflow |
| `PUT` | `/api/workflows/{id}` | Update a workflow |
| `DELETE` | `/api/workflows/{id}` | Delete a workflow |
| `POST` | `/api/workflows/{id}/execute` | Trigger a workflow run |

### Executions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/executions` | List executions (filterable by workflow_id) |
| `GET` | `/api/executions/{id}` | Get execution status and summary |
| `GET` | `/api/executions/{id}/logs` | Get persisted execution logs |
| `GET` | `/api/executions/{id}/messages` | Get inbound/outbound messages |
| `POST` | `/api/executions/{id}/input` | Submit human input to a waiting workflow |
| `WS` | `/ws/executions/{id}/logs` | Real-time log stream (WebSocket) |

### Settings & Channels
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/settings/telegram/status` | Telegram bot connection status |
| `POST` | `/api/settings/telegram/register` | Register the Telegram webhook URL |
| `POST` | `/webhook/telegram` | Telegram update receiver (called by Telegram) |

---

## Running Tests

```bash
cd backend

# Start the test database (or reuse the Docker one)
# export TEST_DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/orchestration_test

pytest -v
```

Test files and what they cover:

| File | Coverage |
|---|---|
| `tests/test_agents.py` | Agent CRUD, field validation, 404 handling |
| `tests/test_workflows.py` | Workflow CRUD, template listing, invalid graph rejection |
| `tests/test_execution.py` | Execution trigger, DB persistence, log/message endpoints, Telegram webhook |
| `tests/test_cost_tracker.py` | Cost math for all models, token counting, free-tier detection |
| `tests/test_graph_builder.py` | Condition expression evaluator, graph compilation with condition/feedback nodes |

---

## Extending the Platform

### Add a New Tool

1. Open `backend/app/runtime/tool_registry.py`.
2. Implement the tool as a LangChain `@tool` or `StructuredTool.from_function(...)`.
3. Add it to `AVAILABLE_TOOLS` with a stable string key.
4. Add the tool to the `TOOL_GROUPS` list in `frontend/src/components/agents/AgentForm.tsx` so it appears in the UI.

```python
# Example: a simple calculator tool
from langchain_core.tools import tool

@tool
def calculate(expression: str) -> str:
    """Safely evaluate a mathematical expression and return the result."""
    import ast, operator
    # ... safe eval logic
    return str(result)

AVAILABLE_TOOLS["calculate"] = calculate
```

### Add a Messaging Channel

1. Create `backend/app/channels/<channel_name>.py`.
2. Implement:
   - A FastAPI `APIRouter` with a webhook endpoint
   - Inbound message parsing and `Message` persistence
   - Workflow resolution (look up which workflow to run)
   - `execute_workflow(...)` trigger as a background task
   - Response delivery back to the channel
3. Register the router in `backend/app/main.py`:
   ```python
   from app.channels.my_channel import router as my_channel_router
   app.include_router(my_channel_router)
   ```
4. Add channel-specific settings to `backend/app/config.py` and `.env.example`.
5. Add `"my_channel"` to the channel dropdown in `frontend/src/components/agents/AgentForm.tsx`.

### Add a Workflow Template

1. Open `backend/seed.py`.
2. Create the agents the template needs.
3. Add a `Workflow` object with `is_template=True` and a `graph_definition` dict:
   ```python
   Workflow(
       name="My Template",
       description="What this workflow does",
       is_template=True,
       graph_definition={
           "nodes": [
               {"id": "start", "type": "start"},
               {"id": "agent-node", "type": "agent", "agent_id": str(my_agent.id)},
               {"id": "end", "type": "end"},
           ],
           "edges": [
               {"id": "e1", "source": "start", "target": "agent-node"},
               {"id": "e2", "source": "agent-node", "target": "end"},
           ],
       },
   )
   ```
4. Mark feedback edges with `"feedback_loop": True` so the graph validator accepts cycles.

---

## Project Structure

```
ai-orchestration-platform/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route handlers (thin — no business logic)
│   │   ├── channels/       # Messaging channel integrations (Telegram, …)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── runtime/        # LangGraph execution engine
│   │   │   ├── agent_node.py       # Builds and runs one agent
│   │   │   ├── executor.py         # Orchestrates a full workflow run
│   │   │   ├── graph_builder.py    # Compiles stored JSON → LangGraph StateGraph
│   │   │   ├── llm_factory.py      # Instantiates LLM from model name + API key
│   │   │   ├── memory_manager.py   # Buffer / summary memory per agent
│   │   │   └── tool_registry.py    # 18 built-in tools
│   │   ├── schemas/        # Pydantic request/response models
│   │   ├── utils/          # Cost tracker, token counter
│   │   ├── config.py       # Settings (pydantic-settings + .env)
│   │   ├── database.py     # Async SQLAlchemy engine + session
│   │   └── main.py         # FastAPI app, CORS, routers
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest test suite
│   ├── seed.py             # Demo agents and workflow templates
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/            # Typed Axios client for all backend endpoints
│       ├── components/     # Reusable UI components (agents, workflow, monitoring)
│       ├── hooks/          # React Query data hooks
│       └── pages/          # Dashboard, Agents, Workflows, Builder, Executions, Chat, Settings
├── docker-compose.yml
└── .env.example
```

---

## Known Limitations

| Limitation | Notes |
|---|---|
| **No authentication** | No user accounts or API tokens. Suitable for local/internal use. Adding OAuth or API key auth is a straightforward FastAPI middleware addition. |
| **Telegram only** | Slack and WhatsApp channel schemas exist but are not implemented. Adding a channel takes ~100 lines following the pattern in `telegram.py`. |
| **Guardrails are advisory** | `max_tokens_per_run` and `max_cost_usd` are stored and visible in the UI but not enforced mid-run. A pre-check per agent step is the natural next step. |
| **No built-in auth for tools** | Tools like `send_email` require global SMTP config; per-agent SMTP credentials are not yet supported. |
| **Gemini token counting** | Tiktoken uses the GPT tokenizer as a proxy for Gemini models. Actual Gemini token counts may differ slightly. |
