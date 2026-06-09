import subprocess
import os
import docker as docker_sdk

# ── TOOLS ─────────────────────────────────────────────────────────────────────

def write_file(filename, content):
    with open(filename, "w") as f:
        f.write(content)
    return f"Written to {filename}"

def run_command(command):
    try:
        client = docker_sdk.from_env()
        container = client.containers.create(
            image="python:3.11-slim",
            command=f"sh -c '{command}'",
            volumes={
                os.path.abspath("."): {
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

def read_file(filename):
    if not os.path.exists(filename):
        return f"Error: {filename} does not exist"
    with open(filename, "r") as f:
        return f.read()

def search_docs(query):
    return f"Search results for '{query}': Use descriptive function names, add docstrings, keep functions small and focused."

TOOLS = {
    "write_file": write_file,
    "run_command": run_command,
    "read_file": read_file,
    "search_docs": search_docs,
}


# ── AGENT LOOP ────────────────────────────────────────────────────────────────

def run_agent(task, call_llm_fn):
    print(f"\n Task: {task}\n")
    print("-" * 50)
    messages = [{"role": "user", "content": task}]

    while True:
        response = call_llm_fn(messages)
        messages.append({"role": "assistant", "content": response["content"]})

        if response["stop_reason"] == "end_turn":
            for block in response["content"]:
                if block["type"] == "text":
                    print(f"\n Agent: {block['text']}")
            print("\n✅ Task complete!")
            break

        tool_results = []
        for block in response["content"]:
            if block["type"] == "tool_use":
                tool_fn = TOOLS.get(block["name"])
                print(f"\n🔧 Tool call : {block['name']}")
                print(f"   Input     : {block['input']}")

                if tool_fn:
                    result = tool_fn(**block["input"])
                else:
                    result = f"Unknown tool: {block['name']}"

                print(f"   Result    : {str(result)[:100]}...")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block["id"],
                    "content": result
                })

        messages.append({"role": "user", "content": tool_results})