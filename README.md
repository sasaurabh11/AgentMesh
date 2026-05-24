# AgentMesh AI Orchestration Platform

AgentMesh is a local, production-oriented AI agent orchestration platform. Users can configure agents, connect them into visual multi-agent workflows, trigger those workflows from the REST API or Telegram, and watch execution logs, inter-agent messages, token usage, and cost in real time.

## Features

- Agent CRUD with model, prompt, tools, memory, guardrails, schedule, and channel configuration
- Dynamic LangGraph workflow execution from persisted graph JSON
- ReactFlow visual workflow builder with agent, condition, start, and end nodes
- Telegram webhook integration for inbound messages and asynchronous execution
- Redis pub/sub bridge for live WebSocket logs
- PostgreSQL persistence for agents, workflows, executions, logs, and messages
- Real LangChain/OpenAI-backed agent execution with tool use
- Celery worker entrypoint for scheduled agents
- Docker Compose single-command local setup

## Architecture

```mermaid
flowchart LR
  Telegram[Telegram] --> FastAPI[FastAPI REST/WebSocket]
  React[React + ReactFlow] --> FastAPI
  FastAPI --> Redis[Redis Pub/Sub + Celery Broker]
  FastAPI --> PostgreSQL[(PostgreSQL)]
  Redis --> WebSocket[Live Log Streams]
  FastAPI --> Runtime[LangGraph Runtime]
  Runtime --> Agents[Agent Nodes: LLM + Tools]
  Agents --> Runtime
  Runtime --> PostgreSQL
  Runtime --> Redis
```

Text path: `Telegram -> FastAPI -> Redis -> LangGraph Runtime -> PostgreSQL`, with agent nodes running LLM calls and real tools during graph execution.

## Why LangGraph

LangGraph was chosen because this platform needs stateful graph execution, native async streaming, conditional edges, and feedback loops. Its state graph model maps directly to stored workflow definitions, so every graph saved in PostgreSQL can be compiled dynamically instead of hardcoded.

## Why FastAPI + React

FastAPI keeps the Python backend async-native for SQLAlchemy, Redis, Telegram, and LangGraph streaming. React with TypeScript gives strong frontend contracts, ergonomic state management, and a natural canvas implementation through ReactFlow.

## Setup

```bash
git clone <your-repo-url>
cd ai-orchestration-platform
cp .env.example .env
# Fill OPENAI_API_KEY and TELEGRAM_BOT_TOKEN when Telegram is needed
docker compose up --build
```

The app is available at [http://localhost:3000](http://localhost:3000). The backend API is available at [http://localhost:8000](http://localhost:8000), and health checks are at `/health`.

## Runtime Notes

Agents execute through `backend/app/runtime/agent_node.py`. The runtime builds a LangChain tools agent with the configured model and tools, injects memory, persists logs, publishes Redis events, tracks tokens with `tiktoken`, and records cost using the pricing table in `backend/app/utils/cost_tracker.py`.

Workflows execute through `backend/app/runtime/executor.py`. The executor loads the workflow, compiles the graph through `graph_builder.py`, streams graph updates, persists execution state, and publishes log events to `execution:{execution_id}:logs`.

## Add a New Tool

1. Open `backend/app/runtime/tool_registry.py`.
2. Implement the tool as a LangChain `@tool` or `StructuredTool`.
3. Add it to `AVAILABLE_TOOLS` with a stable string name.
4. Agents can then select that tool by name in the UI or API.

## Add a Messaging Channel

1. Add a module under `backend/app/channels`.
2. Implement webhook parsing, inbound message persistence, workflow resolution, and response delivery.
3. Register its router in `backend/app/main.py`.
4. Add channel-specific settings to `.env.example`, schemas, and the Settings page.

## Add a Workflow Template

1. Open `backend/seed.py`.
2. Create the required agents.
3. Add a `Workflow` with `is_template=True` and a valid `graph_definition`.
4. Mark intentional feedback edges with `feedback_loop: True` so graph validation accepts loops.

## API Summary

- `POST /api/agents`, `GET /api/agents`, `GET /api/agents/{id}`, `PUT /api/agents/{id}`, `DELETE /api/agents/{id}`
- `POST /api/agents/{id}/test`
- `POST /api/workflows`, `GET /api/workflows`, `GET /api/workflows/{id}`, `PUT /api/workflows/{id}`, `DELETE /api/workflows/{id}`
- `POST /api/workflows/{id}/execute`, `GET /api/workflows/templates`
- `GET /api/executions`, `GET /api/executions/{id}`, `GET /api/executions/{id}/logs`, `GET /api/executions/{id}/messages`
- `WS /ws/executions/{id}/logs`
- `POST /webhook/telegram`

## Tests

```bash
cd backend
TEST_DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/orchestration_test pytest
```

The Docker stack runs the application database. For isolated local tests, create the `orchestration_test` database first or point `TEST_DATABASE_URL` to another PostgreSQL database.

## Free Gemini Models

The platform supports Gemini free-tier models through Google AI Studio. Add your key to `.env`:

```bash
GEMINI_API_KEY=your_google_ai_studio_key_here
DEFAULT_SUMMARY_MODEL=gemini-2.5-flash
```

Default seeded agents use `gemini-2.5-flash`. The UI also includes `gemini-1.5-flash-8b` and `gemini-2.0-flash` options. Gemini free-tier usage is tracked as `$0.00` in the app cost table; Google may still enforce rate limits and quota rules on your API key.

OpenAI models remain available if `OPENAI_API_KEY` is configured, but they are optional.
