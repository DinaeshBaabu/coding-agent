import { useState, useRef, useEffect } from "react"

const TOOL_META = {
  write_file:  { icon: "✦", label: "Write File",   accent: "#f97316", bg: "#fff7ed", border: "#ffedd5", text: "#7c2d12" },
  run_command: { icon: "▶", label: "Run Command",  accent: "#3b82f6", bg: "#eff6ff", border: "#dbeafe", text: "#1e3a5f" },
  read_file:   { icon: "◈", label: "Read File",    accent: "#10b981", bg: "#f0fdf4", border: "#dcfce7", text: "#064e3b" },
  search_docs: { icon: "⌕", label: "Search Docs",  accent: "#8b5cf6", bg: "#faf5ff", border: "#ede9fe", text: "#3b0764" },
}

const DEFAULT_META = { icon: "◆", label: "Tool", accent: "#64748b", bg: "#f8fafc", border: "#e2e8f0", text: "#1e293b" }
const getMeta = (tool) => TOOL_META[tool] || DEFAULT_META

const SUGGESTIONS = [
  "Write a binary search function with tests",
  "Build a stack data structure with tests",
  "Write a palindrome checker with tests",
  "Create a Caesar cipher encoder/decoder",
]

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m} min ${s} sec`
}

function Spinner({ color = "#6366f1", size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14"
      style={{ animation: "spin 0.7s linear infinite", display: "block", flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ProgressBar({ logs }) {
  const calls   = logs.filter(l => l.type === "tool_call").length
  const results = logs.filter(l => l.type === "tool_result").length
  if (calls === 0) return null
  const pct = Math.round((results / calls) * 100)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "4px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#3b82f6)", borderRadius: "99px", transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "11px", color: "#94a3b8", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{results}/{calls}</span>
    </div>
  )
}

function SuggestedTask({ text, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={() => onClick(text)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 13px", fontSize: "12px",
        color:      hovered ? "#6366f1" : "#475569",
        background: hovered ? "#f5f3ff" : "#f8fafc",
        border:    `1px solid ${hovered ? "#c7d2fe" : "#e2e8f0"}`,
        borderRadius: "99px", cursor: "pointer",
        transition: "all 0.15s", fontFamily: "inherit"
      }}
    >{text}</button>
  )
}

function TimelineEntry({ log, isLatest }) {
  const meta = getMeta(log.data?.tool)
  const dotColor =
    log.type === "start"       ? "#6366f1" :
    log.type === "tool_call"   ? meta.accent :
    log.type === "tool_result" ? "#94a3b8" :
    log.type === "done"        ? "#10b981" :
    log.type === "error"       ? "#ef4444" : "#94a3b8"

  return (
    <div style={{ display: "flex", gap: "14px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: dotColor + "18", border: `1.5px solid ${dotColor}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", color: dotColor, fontWeight: "700", flexShrink: 0
        }}>
          {log.type === "start"       ? "⚡" :
           log.type === "tool_call"   ? meta.icon :
           log.type === "tool_result" ? "↩" :
           log.type === "done"        ? "✓" :
           log.type === "error"       ? "!" : "·"}
        </div>
        <div style={{ width: "1px", flex: 1, background: "#f1f5f9", minHeight: "8px" }} />
      </div>

      <div style={{ flex: 1, paddingBottom: "14px", minWidth: 0 }}>
        {log.type === "start" && (
          <div style={{ paddingTop: "4px" }}>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px" }}>New Task</div>
            <div style={{ fontSize: "14px", fontWeight: "500", color: "#0f172a", lineHeight: "1.5" }}>{log.data.task}</div>
          </div>
        )}
        {log.type === "tool_call" && (
          <div style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: "10px", padding: "12px 14px", borderLeft: `3px solid ${meta.accent}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: meta.accent, textTransform: "uppercase", letterSpacing: "0.6px" }}>{meta.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                {isLatest && <Spinner color={meta.accent} />}
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{isLatest ? "executing" : "called"}</span>
              </div>
            </div>
            <pre style={{ margin: 0, fontSize: "11.5px", color: meta.text, fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace", background: "rgba(0,0,0,0.04)", padding: "8px 10px", borderRadius: "6px", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: "1.5" }}>
              {JSON.stringify(log.data.input, null, 2)}
            </pre>
          </div>
        )}
        {log.type === "tool_result" && (
          <div style={{ paddingTop: "2px" }}>
            <div style={{ fontSize: "10px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>
              Output · {log.data.tool?.replace(/_/g, " ")}
            </div>
            <pre style={{ margin: 0, fontSize: "12px", color: "#334155", fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", borderRadius: "8px", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "200px", overflowY: "auto", lineHeight: "1.6" }}>
              {log.data.result}
            </pre>
          </div>
        )}
        {log.type === "done" && (
          <div style={{ background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: "10px", fontWeight: "700" }}>✓</span>
              </div>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#065f46", textTransform: "uppercase", letterSpacing: "0.5px" }}>Completed</span>
            </div>
            <div style={{ fontSize: "13px", color: "#047857", lineHeight: "1.5", paddingLeft: "26px" }}>{log.data.message}</div>
          </div>
        )}
        {log.type === "error" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 14px" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Error</div>
            <div style={{ fontSize: "13px", color: "#991b1b" }}>{log.data.message}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeViewer({ files, folder }) {
  const [activeFile, setActiveFile] = useState(0)

  if (!files || files.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>📂</div>
      <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8" }}>No output files yet</div>
      <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>Run a task to see generated files here</div>
    </div>
  )

  const file = files[activeFile]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "#64748b" }}>📁 runs /</span>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#6366f1", background: "#f5f3ff", padding: "2px 8px", borderRadius: "6px", border: "1px solid #e0e7ff" }}>
          {folder}
        </span>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {files.map((f, i) => (
          <button
            key={f.filename}
            onClick={() => setActiveFile(i)}
            style={{
              padding: "6px 14px", fontSize: "12px", fontWeight: "500",
              background: activeFile === i ? (f.is_test ? "#eff6ff" : "#f5f3ff") : "#f8fafc",
              color: activeFile === i ? (f.is_test ? "#2563eb" : "#6366f1") : "#64748b",
              border: `1px solid ${activeFile === i ? (f.is_test ? "#bfdbfe" : "#c7d2fe") : "#e2e8f0"}`,
              borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s"
            }}
          >
            {f.is_test ? "🧪" : "📄"} {f.filename}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "99px",
          background: file.is_test ? "#eff6ff" : "#f0fdf4",
          color: file.is_test ? "#2563eb" : "#059669",
          border: `1px solid ${file.is_test ? "#bfdbfe" : "#a7f3d0"}`
        }}>
          {file.is_test ? "🧪 TEST FILE" : "📄 SOURCE FILE"}
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
          {file.content.split("\n").length} lines
        </span>
      </div>

      <div style={{ flex: 1, position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <div style={{ background: "#1e293b", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
          </div>
          <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>{file.filename}</span>
          <button
            onClick={() => navigator.clipboard.writeText(file.content)}
            style={{ fontSize: "11px", color: "#64748b", background: "transparent", border: "1px solid #334155", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Copy
          </button>
        </div>
        <div style={{ background: "#0f172a", overflow: "auto", maxHeight: "420px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <tbody>
              {file.content.split("\n").map((line, i) => (
                <tr key={i} style={{ lineHeight: "1.6" }}>
                  <td style={{ width: "42px", padding: "0 12px", textAlign: "right", fontSize: "11px", color: "#334155", userSelect: "none", background: "#0f172a", borderRight: "1px solid #1e293b", verticalAlign: "top", paddingTop: "1px" }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: "0 16px", fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace", fontSize: "12.5px", color: "#e2e8f0", whiteSpace: "pre", verticalAlign: "top" }}>
                    {line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [task, setTask]           = useState("")
  const [logs, setLogs]           = useState([])
  const [running, setRunning]     = useState(false)
  const [status, setStatus]       = useState("idle")
  const [elapsed, setElapsed]     = useState(0)
  const [totalRuns, setTotalRuns] = useState(0)
  const [activeTab, setActiveTab] = useState("logs")
  const [outputFiles, setOutputFiles]   = useState([])
  const [outputFolder, setOutputFolder] = useState("")
  const logsEndRef   = useRef(null)
  const timerRef     = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes spin        { to { transform: rotate(360deg); } }
      @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:0.4} }
      * { box-sizing:border-box; margin:0; padding:0; }
      html, body, #root { height:100%; width:100%; overflow:hidden; }
      body { background:#f1f5f9; font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; }
      ::-webkit-scrollbar       { width:5px; height:5px; }
      ::-webkit-scrollbar-track { background:transparent; }
      ::-webkit-scrollbar-thumb { background:#334155; border-radius:99px; }
      input::placeholder { color:#94a3b8; }
      .entry { animation: fadeSlideIn 0.2s ease; }
    `
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  function addLog(type, data) {
    setLogs(prev => [...prev, { type, data, id: Date.now() + Math.random() }])
  }

  function runAgent(customTask) {
    const t = typeof customTask === "string" ? customTask : task
    if (!t.trim() || running) return
    setTask(t)
    setLogs([])
    setOutputFiles([])
    setOutputFolder("")
    setRunning(true)
    setStatus("running")
    setElapsed(0)
    setTotalRuns(r => r + 1)
    setActiveTab("logs")

    const ws = new WebSocket("ws://127.0.0.1:8000/ws")
    ws.onopen = () => ws.send(JSON.stringify({ task: t }))
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if      (msg.type === "start")       addLog("start",       { task: msg.task })
      else if (msg.type === "tool_call")   addLog("tool_call",   { tool: msg.tool, input: msg.input })
      else if (msg.type === "tool_result") addLog("tool_result", { tool: msg.tool, result: msg.result })
      else if (msg.type === "files") {
        setOutputFiles(msg.files)
        setOutputFolder(msg.folder)
      }
      else if (msg.type === "done")  { addLog("done",  { message: msg.message }); setStatus("done");  setRunning(false) }
      else if (msg.type === "error") { addLog("error", { message: msg.message }); setRunning(false);  setStatus("error") }
    }
    ws.onerror = () => { addLog("error", { message: "Cannot connect — is uvicorn running?" }); setRunning(false); setStatus("error") }
    ws.onclose = () => setRunning(false)
  }

  const toolCalls   = logs.filter(l => l.type === "tool_call").length
  const toolResults = logs.filter(l => l.type === "tool_result").length
  const writeCount  = logs.filter(l => l.type === "tool_call" && l.data.tool === "write_file").length
  const runCount    = logs.filter(l => l.type === "tool_call" && l.data.tool === "run_command").length

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* NAV */}
      <div style={{ height: "54px", flexShrink: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid #e2e8f0", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🤖</div>
          <span style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", letterSpacing: "-0.4px" }}>CodingAgent</span>
          <span style={{ fontSize: "10px", padding: "2px 7px", background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", color: "#6366f1", borderRadius: "99px", fontWeight: "700", border: "1px solid #e0e7ff" }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {running && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6366f1", fontWeight: "600" }}>
              <Spinner color="#6366f1" />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatTime(elapsed)}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: "#94a3b8" }}>
            <span>{totalRuns} {totalRuns === 1 ? "run" : "runs"}</span>
            <div style={{ width: "1px", height: "16px", background: "#e2e8f0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 0 2px #d1fae5", animation: "pulse 2s infinite" }} />
              <span style={{ color: "#10b981", fontWeight: "600" }}>Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: "280px", flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", overflowY: "auto", padding: "24px 18px", display: "flex", flexDirection: "column", gap: "22px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "16px" }}>How it works</div>
            {[
              { icon: "✦", color: "#f97316", title: "Write",   desc: "Generates and writes code to files" },
              { icon: "▶", color: "#3b82f6", title: "Execute", desc: "Runs code safely inside Docker" },
              { icon: "◈", color: "#10b981", title: "Read",    desc: "Inspects output and errors" },
              { icon: "↺", color: "#8b5cf6", title: "Fix",     desc: "Self-corrects until tests pass" },
            ].map((step, i, arr) => (
              <div key={step.title} style={{ display: "flex", gap: "10px", marginBottom: i < arr.length - 1 ? "14px" : 0, position: "relative" }}>
                {i < arr.length - 1 && <div style={{ position: "absolute", left: "12px", top: "28px", width: "1px", height: "calc(100% + 2px)", background: "#f1f5f9" }} />}
                <div style={{ width: "26px", height: "26px", borderRadius: "8px", background: step.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: step.color, flexShrink: 0, fontWeight: "700", border: `1px solid ${step.color}25`, zIndex: 1 }}>{step.icon}</div>
                <div style={{ paddingTop: "3px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b", marginBottom: "2px" }}>{step.title}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.4" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "#f1f5f9" }} />
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>Tools</div>
            {Object.entries(TOOL_META).map(([key, meta]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: meta.accent + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: meta.accent, fontWeight: "700", border: `1px solid ${meta.accent}25` }}>{meta.icon}</div>
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#334155", flex: 1 }}>{meta.label}</span>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: meta.accent, opacity: 0.5 }} />
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "#f1f5f9" }} />
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>Stack</div>
            {[
              { name: "Claude API",  color: "#f97316", desc: "LLM reasoning"  },
              { name: "FastAPI",     color: "#3b82f6", desc: "Python backend" },
              { name: "WebSockets",  color: "#8b5cf6", desc: "Live streaming" },
              { name: "Docker",      color: "#0ea5e9", desc: "Safe execution" },
              { name: "React",       color: "#10b981", desc: "Frontend UI"    },
            ].map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.color, marginRight: "8px", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#475569", flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.6px", marginBottom: "4px" }}>Autonomous Coding Agent</h1>
            <p style={{ fontSize: "13px", color: "#94a3b8" }}>Describe a task — Claude will write, run, and fix the code until it works.</p>
          </div>

          {/* Input */}
          <div style={{ background: "#fff", borderRadius: "14px", padding: "18px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: logs.length > 0 || running ? 0 : "14px" }}>
              <input
                style={{ flex: 1, padding: "11px 14px", fontSize: "14px", border: "1.5px solid #e2e8f0", borderRadius: "10px", color: "#0f172a", background: "#f8fafc", fontFamily: "inherit", transition: "all 0.15s" }}
                value={task}
                onChange={e => setTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runAgent()}
                placeholder="e.g. Write a merge sort function with unit tests..."
                disabled={running}
                onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)" }}
                onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none" }}
              />
              <button
                onClick={() => runAgent()}
                disabled={running}
                style={{ padding: "11px 22px", fontSize: "13px", fontWeight: "600", background: running ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#3b82f6)", color: running ? "#94a3b8" : "#fff", border: "none", borderRadius: "10px", cursor: running ? "not-allowed" : "pointer", boxShadow: running ? "none" : "0 2px 10px rgba(99,102,241,0.35)", transition: "all 0.2s", whiteSpace: "nowrap", fontFamily: "inherit" }}
              >
                {running ? "Running..." : "▶  Run"}
              </button>
            </div>
            {!running && logs.length === 0 && (
              <div style={{ marginTop: "14px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "9px" }}>Try these</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {SUGGESTIONS.map(s => <SuggestedTask key={s} text={s} onClick={runAgent} />)}
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          {status !== "idle" && (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "12px 16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "9px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {running && <Spinner />}
                  <span style={{ fontSize: "13px", fontWeight: "600", color: status === "done" ? "#059669" : status === "error" ? "#dc2626" : "#6366f1" }}>
                    {status === "running" ? "Agent is working..." : status === "done" ? "Task completed" : "Error occurred"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: "#64748b" }}>
                  <span>🔧 <strong style={{ color: "#334155" }}>{toolCalls}</strong></span>
                  <span>✓ <strong style={{ color: "#334155" }}>{toolResults}</strong></span>
                  {running && <span style={{ color: "#6366f1", fontWeight: "600" }}>⏱ {formatTime(elapsed)}</span>}
                </div>
              </div>
              <ProgressBar logs={logs} />
            </div>
          )}

          {/* TABS */}
          {logs.length > 0 && (
            <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
              {[
                { id: "logs",   label: "⚡ Live Logs",    badge: logs.length },
                { id: "output", label: "📄 Output Files", badge: outputFiles.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "7px 16px", fontSize: "12px", fontWeight: "600",
                    background: activeTab === tab.id ? "#fff" : "transparent",
                    color: activeTab === tab.id ? "#0f172a" : "#64748b",
                    border: "none", borderRadius: "7px", cursor: "pointer",
                    boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "700", background: activeTab === tab.id ? "#f1f5f9" : "#e2e8f0", color: "#64748b", padding: "1px 6px", borderRadius: "99px" }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === "logs" && (
            <div style={{ background: "#fff", borderRadius: "14px", padding: "20px 20px 8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flex: 1, minHeight: "300px" }}>
              {logs.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "260px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "12px", border: "1px solid #e0e7ff" }}>🤖</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px" }}>Ready to run</div>
                  <div style={{ fontSize: "12px", color: "#cbd5e1" }}>Enter a task above or pick a suggestion</div>
                </div>
              ) : (
                <div>
                  {logs.map((log, i) => (
                    <div key={log.id} className="entry">
                      <TimelineEntry log={log} isLatest={i === logs.length - 1 && running} />
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}

          {/* OUTPUT FILES TAB */}
          {activeTab === "output" && (
            <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flex: 1 }}>
              <CodeViewer files={outputFiles} folder={outputFolder} />
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ width: "300px", flexShrink: 0, background: "#fff", borderLeft: "1px solid #e2e8f0", overflowY: "auto", padding: "24px 18px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Status</div>
            <div style={{ padding: "12px", borderRadius: "10px", background: status === "done" ? "#f0fdf4" : status === "error" ? "#fef2f2" : status === "running" ? "#f5f3ff" : "#f8fafc", border: `1px solid ${status === "done" ? "#a7f3d0" : status === "error" ? "#fecaca" : status === "running" ? "#ddd6fe" : "#e2e8f0"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: running ? "6px" : 0 }}>
                {status === "running" && <Spinner />}
                <span style={{ fontSize: "13px", fontWeight: "600", color: status === "done" ? "#059669" : status === "error" ? "#dc2626" : status === "running" ? "#6366f1" : "#94a3b8" }}>
                  {status === "idle" ? "Idle" : status === "running" ? "Running" : status === "done" ? "Done ✓" : "Error"}
                </span>
              </div>
              {running && <div style={{ fontSize: "12px", color: "#6366f1", fontWeight: "500" }}>{formatTime(elapsed)}</div>}
            </div>
          </div>
          <div style={{ height: "1px", background: "#f1f5f9" }} />
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>This Run</div>
            {[
              { label: "Tool Calls",    value: toolCalls,           color: "#6366f1" },
              { label: "Completed",     value: toolResults,         color: "#10b981" },
              { label: "Files Written", value: writeCount,          color: "#f97316" },
              { label: "Executions",    value: runCount,            color: "#3b82f6" },
              { label: "Time",          value: formatTime(elapsed), color: "#8b5cf6" },
            ].map(stat => (
              <div key={stat.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{stat.label}</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: stat.color, fontVariantNumeric: "tabular-nums" }}>{stat.value}</span>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "#f1f5f9" }} />
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Session</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Total Runs</span>
              <span style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{totalRuns}</span>
            </div>
            {outputFolder && (
              <div style={{ marginTop: "10px", padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "10px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px" }}>SAVED TO</div>
                <div style={{ fontSize: "11px", color: "#6366f1", fontWeight: "600", wordBreak: "break-all" }}>runs/{outputFolder}</div>
              </div>
            )}
          </div>
          <div style={{ height: "1px", background: "#f1f5f9" }} />
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>Tips</div>
            {[
              "Ask for unit tests to see the agent self-correct",
              "Try data structures like trees or linked lists",
              "Ask for error handling to see edge case detection",
            ].map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#94a3b8", flexShrink: 0, marginTop: "1px" }}>{i + 1}</div>
                <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.5" }}>{tip}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}