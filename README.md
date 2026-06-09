# Autonomous Coding Agent

An AI agent project I built to learn how AI agents work in practice. The agent takes a coding task, writes the code, runs it, reads the output, and fixes any errors — all on its own without any human input in between.

I built this to go beyond basic API tutorials and actually understand what's happening inside tools like Cursor and GitHub Copilot at a conceptual level.

---

## Screenshots

### Dashboard
![Dashboard](screenshots/Dashboard.png)

### Agent working in real time
![Live Logs](screenshots/live_logs.png)

### Final generated code
![Output Files](screenshots/output_files.png)

---

## What it does

You type a task like "write a binary search function with unit tests" and the agent:

- Writes the Python code to a file
- Runs it inside a Docker container
- Reads the output and any errors
- Fixes mistakes and runs it again
- Keeps going until the tests pass

Every step streams live to the frontend so you can watch it work in real time.

---

## What I used

- **Python + FastAPI** for the backend
- **Anthropic Claude API** for the AI reasoning (tool_use feature)
- **WebSockets** to stream live updates to the UI
- **Docker** to run the generated code safely in an isolated container
- **React** for the frontend

---

## What I learned

This was my first time building something with an actual AI agent loop instead of just a single API call. A few things that clicked for me while building this:

- The LLM doesn't run code — it just decides what to do, and your code does the actual work. Understanding this distinction made everything else make sense.
- WebSockets are much more interesting than regular HTTP when you need live updates — the frontend just listens and reacts to whatever the server sends.
- Docker isn't just for deployment — using it as a sandbox for running untrusted code was a completely new use case for me.
- Writing good tool descriptions for the LLM matters a lot. Vague descriptions lead to bad decisions.

---

## Project structure

```
coding-agent/
├── server.py       — backend, agent loop, tool execution
├── agent.py        — standalone CLI version
├── frontend/       — React UI
└── runs/           — generated code saved here per task
```

