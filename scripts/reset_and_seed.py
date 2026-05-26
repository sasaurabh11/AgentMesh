"""
Reset all agents/workflows and seed with production-quality demo content.
Run: python scripts/reset_and_seed.py
"""
import httpx, json, sys

BASE = "http://localhost:8000"

def api(method, path, **kw):
    r = httpx.request(method, BASE + path, timeout=30, **kw)
    if r.status_code >= 400:
        print(f"  ERROR {r.status_code}: {r.text[:200]}")
        return None
    return r.json() if r.content else None

# ── 1. Delete all existing agents and workflows ──────────────────────────────
print("Deleting existing agents...")
for a in (api("GET", "/api/agents") or []):
    api("DELETE", f"/api/agents/{a['id']}")
    print(f"  deleted agent: {a['name']}")

print("Deleting existing workflows...")
for w in (api("GET", "/api/workflows") or []):
    api("DELETE", f"/api/workflows/{w['id']}")
    print(f"  deleted workflow: {w['name']}")

# ── 2. Create Agents ──────────────────────────────────────────────────────────
print("\nCreating agents...")

agents = {}

def create_agent(name, role, system_prompt, model, tools, channel=None):
    data = dict(
        name=name, role=role, system_prompt=system_prompt,
        model=model, tools=tools, memory_enabled=False,
        memory_config={}, guardrails={"max_tokens_per_run": 8000, "max_cost_usd": 5},
        schedule=None, channel=channel, channel_config={}
    )
    result = api("POST", "/api/agents", json=data)
    if result:
        agents[name] = result["id"]
        print(f"  ✓ {name} ({result['id']})")
    return result

# 1. Web Researcher
create_agent(
    name="Web Researcher",
    role="Searches the web to gather accurate, up-to-date information on any topic",
    system_prompt="""You are an expert Web Researcher. Your job is to search the web and gather accurate, relevant, and up-to-date information on the given topic.

Instructions:
- Use the web_search tool to find current information
- Search multiple angles of the topic (main topic, recent news, expert opinions)
- Summarize findings clearly with sources (URLs)
- Structure your output as:
  ## Summary
  [2-3 sentence overview]

  ## Key Findings
  [Bullet points with the most important facts]

  ## Sources
  [List of URLs referenced]

Always verify facts across multiple search results before including them.""",
    model="gemini-2.5-flash",
    tools=["web_search", "summarize_text"]
)

# 2. Content Writer
create_agent(
    name="Content Writer",
    role="Transforms research and data into engaging, well-structured written content",
    system_prompt="""You are a professional Content Writer who creates engaging, clear, and well-structured written content.

Given research findings or raw information, you:
- Write in a clear, engaging style appropriate for the audience
- Structure content with proper headings, introduction, and conclusion
- Make complex topics accessible and interesting
- Save the final content to a file using write_file when asked
- Use markdown formatting for readability

Output formats you excel at: blog posts, reports, summaries, articles, documentation.
Always produce polished, publication-ready content.""",
    model="gemini-2.5-flash",
    tools=["write_file", "summarize_text"]
)

# 3. Code Developer
create_agent(
    name="Code Developer",
    role="Writes, runs, and debugs Python code to solve computational problems",
    system_prompt="""You are an expert Python Developer. You write clean, efficient, well-commented code to solve problems.

Your workflow:
1. Understand the problem clearly
2. Plan your approach before coding
3. Write the Python code
4. Run it using python_repl to verify it works
5. Fix any errors and re-run until correct
6. Save the final code using write_file if needed

Code standards:
- Write clean, readable code with clear variable names
- Add brief comments for non-obvious logic
- Handle edge cases and potential errors
- Test with example inputs before finalizing

You can use python_repl to execute code, read_file to read existing files, and write_file to save results.""",
    model="gemini-2.5-flash",
    tools=["python_repl", "read_file", "write_file"]
)

# 4. Data Analyst
create_agent(
    name="Data Analyst",
    role="Analyzes data using Python to extract insights, statistics and visualizations",
    system_prompt="""You are a skilled Data Analyst. You analyze data and extract meaningful insights using Python.

Your capabilities:
- Run statistical analysis using python_repl (numpy, pandas, statistics)
- Calculate metrics: averages, percentages, trends, correlations
- Identify patterns and anomalies in data
- Create clear, structured analysis reports
- Fetch data from APIs using http_request when needed

Analysis output format:
## Analysis Summary
[Key findings in plain English]

## Statistics
[Relevant numbers and calculations]

## Insights
[What the data means, patterns found]

## Recommendations
[Actionable conclusions based on the data]

Always show your calculations by running code, not just stating results.""",
    model="gemini-2.5-flash",
    tools=["python_repl", "http_request", "web_search"]
)

# 5. Telegram Support Agent
create_agent(
    name="Support Agent",
    role="Friendly customer support agent that answers questions and solves problems via Telegram",
    system_prompt="""You are a helpful and friendly Support Agent for AgentMesh — an AI orchestration platform.

You assist users through Telegram with:
- Answering questions about how to use AgentMesh
- Explaining AI concepts in simple terms
- Searching for information when needed
- Guiding users step-by-step through problems

Communication style:
- Friendly, warm, and patient
- Clear and concise — no unnecessary jargon
- Use emojis sparingly for warmth (1-2 per message max)
- Break complex answers into numbered steps
- Always end with "Is there anything else I can help you with?"

If you don't know something, say so honestly and offer to search for it using web_search.""",
    model="gemini-2.5-flash",
    tools=["web_search"],
    channel="telegram"
)

# 6. Orchestrator
create_agent(
    name="Orchestrator",
    role="Master coordinator that routes tasks to specialist agents and asks users for clarification",
    system_prompt="""You are the Orchestrator — the master coordinator for AgentMesh.

Your job:
1. Understand what the user wants to accomplish
2. If unclear, use request_human_input to ask ONE focused clarifying question at a time
3. Delegate tasks to the best specialist agent using delegate_to_agent
4. Combine and present the results clearly

Available specialist agents:
""" + "\n".join(f"  - {name}: {desc}" for name, desc in [
    ("Web Researcher", "Search and gather information from the web"),
    ("Content Writer", "Write articles, reports, blog posts"),
    ("Code Developer", "Write and run Python code"),
    ("Data Analyst", "Analyze data and extract insights"),
]) + """

Rules:
- Never answer specialist questions yourself — always delegate
- Ask at most 2 clarifying questions before acting
- Combine outputs from multiple agents when needed
- Present results in a clean, structured format""",
    model="gemini-2.5-flash",
    tools=["delegate_to_agent", "request_human_input"]
)

# ── 3. Create Workflows ───────────────────────────────────────────────────────
print("\nCreating workflows...")

def node(id, type, label, x, y, agent_id=None):
    n = {"id": id, "type": type, "label": label, "position": {"x": x, "y": y}}
    if agent_id:
        n["agent_id"] = agent_id
    return n

def edge(id, source, target):
    return {"id": id, "source": source, "target": target}

def create_workflow(name, description, nodes, edges):
    data = dict(
        name=name, description=description,
        graph_definition={"nodes": nodes, "edges": edges},
        is_template=False
    )
    result = api("POST", "/api/workflows", json=data)
    if result:
        print(f"  ✓ {name} ({result['id']})")
    return result

# ── Workflow 1: Research & Blog Post ─────────────────────────────────────────
create_workflow(
    name="Research & Blog Post Generator",
    description="Takes a topic, researches it on the web, then writes a polished blog post and saves it as a file.",
    nodes=[
        node("start",    "start",  "Start",          100, 200),
        node("research", "agent",  "Web Researcher",  350, 200, agents.get("Web Researcher")),
        node("write",    "agent",  "Content Writer",  600, 200, agents.get("Content Writer")),
        node("end",      "end",    "End",             850, 200),
    ],
    edges=[
        edge("e1", "start",    "research"),
        edge("e2", "research", "write"),
        edge("e3", "write",    "end"),
    ]
)

# ── Workflow 2: Data Analysis Pipeline ───────────────────────────────────────
create_workflow(
    name="Data Analysis & Report",
    description="Analyzes data or a question using Python, then produces a professional report written by the Content Writer.",
    nodes=[
        node("start",   "start", "Start",          100, 200),
        node("analyze", "agent", "Data Analyst",    350, 200, agents.get("Data Analyst")),
        node("report",  "agent", "Content Writer",  600, 200, agents.get("Content Writer")),
        node("end",     "end",   "End",             850, 200),
    ],
    edges=[
        edge("e1", "start",   "analyze"),
        edge("e2", "analyze", "report"),
        edge("e3", "report",  "end"),
    ]
)

# ── Workflow 3: Code & Verify ─────────────────────────────────────────────────
create_workflow(
    name="Code Generator & Verifier",
    description="Takes a coding task, writes Python code, runs it to verify it works, then documents the solution.",
    nodes=[
        node("start",  "start", "Start",           100, 200),
        node("code",   "agent", "Code Developer",   350, 200, agents.get("Code Developer")),
        node("docs",   "agent", "Content Writer",   600, 200, agents.get("Content Writer")),
        node("end",    "end",   "End",              850, 200),
    ],
    edges=[
        edge("e1", "start", "code"),
        edge("e2", "code",  "docs"),
        edge("e3", "docs",  "end"),
    ]
)

# ── Workflow 4: Telegram Support Bot ─────────────────────────────────────────
create_workflow(
    name="Telegram Support Bot",
    description="Handles user messages from Telegram. Searches the web for answers and responds directly to the user.",
    nodes=[
        node("start",   "start", "Start",         100, 200),
        node("support", "agent", "Support Agent",  350, 200, agents.get("Support Agent")),
        node("end",     "end",   "End",            600, 200),
    ],
    edges=[
        edge("e1", "start",   "support"),
        edge("e2", "support", "end"),
    ]
)

# ── TEMPLATES (with conditional nodes) ───────────────────────────────────────
print("\nCreating workflow templates...")

def cond_node(id, label, expr, x, y):
    return {"id": id, "type": "condition", "label": label,
            "condition_expr": expr, "position": {"x": x, "y": y}}

def edge_labeled(id, source, target, label):
    return {"id": id, "source": source, "target": target, "label": label}

def create_template(name, description, nodes, edges):
    data = dict(
        name=name, description=description,
        graph_definition={"nodes": nodes, "edges": edges},
        is_template=True
    )
    result = api("POST", "/api/workflows", json=data)
    if result:
        print(f"  ✓ [TEMPLATE] {name}")
    return result


# ── Template 1: Smart Research with Quality Gate ──────────────────────────────
# Flow: Research → Quality Check → if GOOD → Write & Publish
#                                → if REVISE → Research again → Write
#
# Condition checks if research output contains "Key Findings" (quality marker)
create_template(
    name="Smart Research with Quality Gate",
    description=(
        "Researches a topic, checks if the research is detailed enough, "
        "then routes to writing. If research is poor quality it loops back to re-research. "
        "Uses a condition node to enforce quality before writing."
    ),
    nodes=[
        node("start",       "start",     "Start",                100, 250),
        node("researcher",  "agent",     "Web Researcher",        350, 250, agents.get("Web Researcher")),
        cond_node("quality_check", "Quality OK?",
                  "agent_outputs['researcher'] contains 'Key Findings'",  650, 250),
        node("writer",      "agent",     "Content Writer",        900, 100, agents.get("Content Writer")),
        node("reresearch",  "agent",     "Web Researcher",        900, 400, agents.get("Web Researcher")),
        node("final_write", "agent",     "Content Writer",       1150, 400, agents.get("Content Writer")),
        node("end",         "end",       "End",                  1150, 100),
        node("end2",        "end",       "End",                  1400, 400),
    ],
    edges=[
        edge("e1", "start",        "researcher"),
        edge_labeled("e2", "researcher",  "quality_check", ""),
        edge_labeled("e3", "quality_check", "writer",      "true"),
        edge_labeled("e4", "quality_check", "reresearch",  "false"),
        edge("e5", "writer",       "end"),
        edge("e6", "reresearch",   "final_write"),
        edge("e7", "final_write",  "end2"),
    ]
)


# ── Template 2: Customer Support Triage ──────────────────────────────────────
# Flow: Triage Agent classifies query → Condition checks type
#       → "technical" → Technical Expert → Response Writer
#       → "billing"   → Billing Expert   → Response Writer
#
create_agent(
    name="Triage Agent",
    role="Classifies incoming support requests as technical or billing issues",
    system_prompt="""You are a Support Triage Agent. Your only job is to classify the user's message.

Read the user's request carefully and output EXACTLY one of these two words:
- technical  (for questions about features, bugs, integrations, setup, code, APIs)
- billing    (for questions about pricing, invoices, subscriptions, payments, refunds)

Output ONLY the single word — nothing else. No explanation, no punctuation.""",
    model="gemini-2.5-flash",
    tools=[]
)

create_agent(
    name="Technical Expert",
    role="Solves technical problems, integration issues and answers developer questions",
    system_prompt="""You are a Senior Technical Expert. You solve technical problems clearly and precisely.

When given a support query:
1. Acknowledge the issue
2. Provide a clear, step-by-step solution
3. Include code examples where relevant
4. Suggest preventive measures if applicable

Be specific, thorough, and technically accurate. If web search would help, use it.""",
    model="gemini-2.5-flash",
    tools=["web_search", "python_repl"]
)

create_agent(
    name="Billing Expert",
    role="Handles billing questions, subscription issues and payment inquiries",
    system_prompt="""You are a Billing Support Expert. You handle all financial and subscription queries professionally.

When given a billing query:
1. Acknowledge the concern with empathy
2. Explain the billing policy clearly
3. Provide the resolution or next steps
4. Offer escalation path if needed

Be professional, empathetic, and clear. Always reassure the customer.""",
    model="gemini-2.5-flash",
    tools=[]
)

create_agent(
    name="Response Writer",
    role="Formats expert answers into polished, professional customer-facing responses",
    system_prompt="""You are a Response Writer. You take technical or billing answers and format them into polished, friendly customer-facing responses.

Format:
- Warm greeting using the context
- Clear answer in plain language
- Numbered steps if applicable
- Friendly closing line
- Offer to help further

Keep it concise but complete. Professional yet warm tone.""",
    model="gemini-2.5-flash",
    tools=[]
)

create_template(
    name="Customer Support Triage",
    description=(
        "Automatically classifies incoming support requests as Technical or Billing. "
        "Routes to the appropriate expert agent, then formats a polished response. "
        "Demonstrates conditional branching based on AI classification."
    ),
    nodes=[
        node("start",    "start",  "Start",            100, 250),
        node("triage",   "agent",  "Triage Agent",      330, 250, agents.get("Triage Agent")),
        cond_node("route", "Technical or Billing?",
                  "agent_outputs['triage'] contains 'technical'",  570, 250),
        node("tech",     "agent",  "Technical Expert",  820, 100, agents.get("Technical Expert")),
        node("billing",  "agent",  "Billing Expert",    820, 400, agents.get("Billing Expert")),
        node("respond1", "agent",  "Response Writer",  1080, 100, agents.get("Response Writer")),
        node("respond2", "agent",  "Response Writer",  1080, 400, agents.get("Response Writer")),
        node("end1",     "end",    "End",              1320, 100),
        node("end2",     "end",    "End",              1320, 400),
    ],
    edges=[
        edge("e1", "start",    "triage"),
        edge_labeled("e2", "triage",   "route",    ""),
        edge_labeled("e3", "route",    "tech",     "true"),
        edge_labeled("e4", "route",    "billing",  "false"),
        edge("e5", "tech",     "respond1"),
        edge("e6", "billing",  "respond2"),
        edge("e7", "respond1", "end1"),
        edge("e8", "respond2", "end2"),
    ]
)


# ── Template 3: Code Review & Auto-Fix Pipeline ───────────────────────────────
# Flow: Developer writes code → Reviewer checks it
#       → Condition: does review say "approve"?
#         YES → Document & Ship
#         NO  → Developer fixes → Document & Ship
#
create_agent(
    name="Code Reviewer",
    role="Reviews Python code for correctness, security issues and best practices",
    system_prompt="""You are a strict but fair Senior Code Reviewer. You review Python code thoroughly.

Review checklist:
- Correctness: Does the code do what it claims?
- Security: Any injection, exposure, or unsafe operations?
- Performance: Obvious inefficiencies?
- Style: Readable, well-named variables, proper structure?
- Edge cases: Handles None, empty inputs, errors?

Your output MUST end with exactly one of these verdicts on its own line:
  VERDICT: approve
  VERDICT: revise

Then explain your reasoning. If revising, list specific issues to fix.""",
    model="gemini-2.5-flash",
    tools=["python_repl"]
)

create_template(
    name="Code Review & Auto-Fix Pipeline",
    description=(
        "Writes code for a task, sends it through a code reviewer, "
        "then uses a condition node to check the verdict. "
        "Approved code gets documented. Rejected code is automatically fixed and then documented."
    ),
    nodes=[
        node("start",    "start",  "Start",              100, 250),
        node("dev",      "agent",  "Code Developer",      330, 250, agents.get("Code Developer")),
        node("review",   "agent",  "Code Reviewer",       580, 250, agents.get("Code Reviewer")),
        cond_node("verdict", "Review Passed?",
                  "agent_outputs['review'] contains 'approve'",   830, 250),
        node("document", "agent",  "Content Writer",     1080, 100, agents.get("Content Writer")),
        node("fix",      "agent",  "Code Developer",     1080, 400, agents.get("Code Developer")),
        node("doc_fix",  "agent",  "Content Writer",     1320, 400, agents.get("Content Writer")),
        node("end1",     "end",    "End",                1320, 100),
        node("end2",     "end",    "End",                1560, 400),
    ],
    edges=[
        edge("e1", "start",   "dev"),
        edge("e2", "dev",     "review"),
        edge_labeled("e3", "review",  "verdict",  ""),
        edge_labeled("e4", "verdict", "document", "true"),
        edge_labeled("e5", "verdict", "fix",      "false"),
        edge("e6", "document","end1"),
        edge("e7", "fix",     "doc_fix"),
        edge("e8", "doc_fix", "end2"),
    ]
)


# ── Done ──────────────────────────────────────────────────────────────────────
print(f"\n✅ Done! Created {len(agents)} agents and 4 workflows + 3 templates.")
print("\nAgents created:")
for name, id in agents.items():
    print(f"  {name}: {id}")
