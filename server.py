from dotenv import load_dotenv
import os
import re
from pathlib import Path
load_dotenv()

import asyncio
import json
import anthropic
import docker as docker_sdk
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LLM ───────────────────────────────────────────────────────────────────────

anthropic_client = anthropic.Anthropic()

TOOL_DEFINITIONS = [
    {
        "name": "write_file",
        "description": "Write content to a file on disk",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Name of the file to write"},
                "content":  {"type": "string", "description": "Content to write into the file"}
            },
            "required": ["filename", "content"]
        }
    },
    {
        "name": "run_command",
        "description": "Run a shell command inside a Docker container and return the output",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to run"}
            },
            "required": ["command"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file on disk",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Name of the file to read"}
            },
            "required": ["filename"]
        }
    },
    {
        "name": "search_docs",
        "description": "Search for Python documentation and best practices",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The topic to search for"}
            },
            "required": ["query"]
        }
    }
]

def call_llm(messages):
    response = anthropic_client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        tools=TOOL_DEFINITIONS,
        system=(
            "You are an autonomous coding agent. Use the tools available to complete coding tasks. "
            "Write code to files, run them, read the output, and fix any errors until the task is fully complete. "
            "Always verify your code works by running it. "
            "Do not use special unicode characters like checkmarks in your Python code — use plain ASCII only. "
            "Be efficient — complete tasks in as few steps as possible. "
            "IMPORTANT: When calling write_file, you MUST always include BOTH filename AND content fields. Never call write_file with only a filename."
        ),
        messages=messages
    )

    content = []
    for block in response.content:
        if block.type == "text":
            content.append({"type": "text", "text": block.text})
        elif block.type == "tool_use":
            content.append({
                "type": "tool_use",
                "id":    block.id,
                "name":  block.name,
                "input": block.input
            })

    return {
        "stop_reason": response.stop_reason,
        "content":     content
    }


# ── FOLDER HELPER ─────────────────────────────────────────────────────────────

def make_run_folder(task):
    words = task.lower().strip().split()[:5]
    folder_name = "_".join(re.sub(r"[^a-z0-9]", "", w) for w in words if w)
    folder_name = folder_name[:40]
    run_dir = Path("runs") / folder_name
    run_dir.mkdir(parents=True, exist_ok=True)
    return str(run_dir), folder_name


# ── TOOLS ─────────────────────────────────────────────────────────────────────

def write_file(filename, content=None, run_dir=".", **kwargs):
    if content is None:
        content = kwargs.get("content", "")
    filepath = Path(run_dir) / filename
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return f"Written to {filepath}"

def run_command(command=None, run_dir=".", **kwargs):
    if command is None:
        command = kwargs.get("command", "echo no command provided")
    try:
        client = docker_sdk.from_env()
        abs_run_dir = str(Path(os.path.abspath(".")) / run_dir)
        container = client.containers.create(
            image="python:3.11-slim",
            command=f"sh -c '{command}'",
            volumes={
                abs_run_dir: {
                    "bind": "/workspace",
                    "mode": "rw"
                }
            },
            working_dir="/workspace",
            mem_limit="128m",
            network_disabled=True,
        )
        container.start()
        container.wait(timeout=15)
        output = container.logs(stdout=True, stderr=True).decode("utf-8")
        container.remove()
        return output
    except docker_sdk.errors.ContainerError as e:
        return f"Error: {e.stderr.decode('utf-8')}"
    except Exception as e:
        return f"Docker error: {str(e)}"

def read_file(filename=None, run_dir=".", **kwargs):
    if filename is None:
        filename = kwargs.get("filename", "")
    filepath = Path(run_dir) / filename
    if not filepath.exists():
        return f"Error: {filepath} does not exist"
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def search_docs(query=None, **kwargs):
    if query is None:
        query = kwargs.get("query", "")
    return f"Search results for '{query}': Use descriptive function names, add docstrings, keep functions small and focused."

def get_output_files(run_dir):
    """Read all .py files from the run folder for the output tab"""
    files = []
    run_path = Path(run_dir)
    for filepath in sorted(run_path.glob("*.py")):
        try:
            content = filepath.read_text(encoding="utf-8")
            files.append({
                "filename": filepath.name,
                "content": content,
                "is_test": filepath.name.startswith("test_")
            })
        except Exception:
            pass
    return files


# ── WEBSOCKET ─────────────────────────────────────────────────────────────────

async def send(ws: WebSocket, event_type: str, data: dict):
    await ws.send_text(json.dumps({"type": event_type, **data}))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    data = await websocket.receive_text()
    task = json.loads(data)["task"]

    # Create run folder based on task name
    run_dir, folder_name = make_run_folder(task)

    await send(websocket, "start", {"task": task, "folder": folder_name})

    messages       = [{"role": "user", "content": f"{task}\n\nSave all files to the current directory."}]
    MAX_ITERATIONS = 12
    iteration      = 0

    # Wrap tools with run_dir context
    def tools_write_file(**kwargs):
        return write_file(run_dir=run_dir, **kwargs)

    def tools_run_command(**kwargs):
        return run_command(run_dir=run_dir, **kwargs)

    def tools_read_file(**kwargs):
        return read_file(run_dir=run_dir, **kwargs)

    TOOLS = {
        "write_file":  tools_write_file,
        "run_command": tools_run_command,
        "read_file":   tools_read_file,
        "search_docs": search_docs,
    }

    while iteration < MAX_ITERATIONS:
        iteration += 1
        try:
            response = call_llm(messages)
            messages.append({"role": "assistant", "content": response["content"]})

            if response["stop_reason"] == "end_turn":
                for block in response["content"]:
                    if block["type"] == "text":
                        await send(websocket, "done", {"message": block["text"]})

                # Send final output files for the Output tab
                output_files = get_output_files(run_dir)
                await send(websocket, "files", {
                    "folder": folder_name,
                    "files":  output_files
                })
                break

            tool_results = []
            for block in response["content"]:
                if block["type"] == "tool_use":
                    tool_fn = TOOLS.get(block["name"])

                    await send(websocket, "tool_call", {
                        "tool":  block["name"],
                        "input": block["input"]
                    })

                    await asyncio.sleep(0.5)

                    result = tool_fn(**block["input"]) if tool_fn else f"Unknown tool: {block['name']}"

                    await send(websocket, "tool_result", {
                        "tool":   block["name"],
                        "result": str(result)[:300]
                    })

                    await asyncio.sleep(0.5)

                    tool_results.append({
                        "type":        "tool_result",
                        "tool_use_id": block["id"],
                        "content":     result
                    })

            messages.append({"role": "user", "content": tool_results})

        except Exception as e:
            await send(websocket, "error", {"message": str(e)})
            break

    if iteration >= MAX_ITERATIONS:
        output_files = get_output_files(run_dir)
        await send(websocket, "done", {
            "message": f"Reached maximum of {MAX_ITERATIONS} iterations."
        })
        await send(websocket, "files", {
            "folder": folder_name,
            "files":  output_files
        })

    await websocket.close()


# ── HEALTH CHECK ──────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Agent server is running"}