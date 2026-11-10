"use client";

import React, { useState } from "react";
import {
  Flame,
  AlertTriangle,
  Server,
  Bot,
  Activity,
  Send,
  Terminal,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";

interface IncidentLog {
  id: string;
  timestamp: string;
  title: string;
  service: string;
  status: number;
  eventId?: string;
  detail: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  time: string;
}

export default function ChaosDashboard() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [incidentCount, setIncidentCount] = useState(0);
  const [incidentHistory, setIncidentHistory] = useState<IncidentLog[]>([]);

  // Agent chat preview state
  const [agentInput, setAgentInput] = useState("What caused the recent checkout crash? Check the Sentry logs.");
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "**Log Agent initialized.** I am listening to the Incident Command Center room via Switch. Ask me about recent crashes or server incidents.",
      time: "Just now",
    },
  ]);

  const handleSimulateCrash = async () => {
    setIsSimulating(true);
    setLastError(null);

    try {
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Database connection timeout in cart-service: pool exhausted after 30000ms",
        }),
      });

      const data = await response.json().catch(() => ({}));

      const newIncident: IncidentLog = {
        id: `INC-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toLocaleTimeString(),
        title: data.error || "Simulated 500 Internal Server Error",
        service: data.service || "cart-service",
        status: response.status || 500,
        eventId: data.eventId,
        detail: "Stack frame: checkoutCart (cart_service.ts:142:23) -> ECONNREFUSED",
      };

      setIncidentCount((prev) => prev + 1);
      setLastError(data.error || "HTTP 500 Internal Server Error");
      setIncidentHistory((prev) => [newIncident, ...prev.slice(0, 7)]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error triggering crash";
      setLastError(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim() || isAgentLoading) return;

    const userMsg = agentInput.trim();
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMsg, time: now },
    ];
    setMessages(newMessages);
    setAgentInput("");
    setIsAgentLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const assistantText = data?.content || data?.error || "Agent returned an empty response.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting agent API";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Failed to reach Log Agent: ${msg}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0d1322]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm shadow-rose-950/50">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-slate-100 text-base tracking-tight">
                Switch Incident Command Center
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Next.js Chaos Dashboard • Sentry Telemetry • Switch Agent Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Target:</span>
            <span className="font-mono text-slate-200">cart-service:5000</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Switch Agent:</span>
            <span className="font-mono text-cyan-300">/api/agent</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chaos Control + Incident Telemetry (7 cols) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col">
          {/* Chaos Injection Card */}
          <div className="rounded-xl border border-rose-950/50 bg-gradient-to-br from-slate-900/90 via-[#111625] to-slate-950 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase tracking-wider mb-1">
                  <ShieldAlert className="w-4 h-4" />
                  Chaos Injection Suite
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Simulate Production Outages
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Trigger deterministic failures to test Sentry exception capture and verify real-time diagnosis by the Switch Log Agent.
                </p>
              </div>

              <div className="text-right">
                <span className="text-2xl font-mono font-bold text-rose-400">
                  {incidentCount}
                </span>
                <p className="text-[10px] uppercase font-mono text-slate-500">
                  Crashes Triggered
                </p>
              </div>
            </div>

            {/* The Prominent Button */}
            <div className="mt-4 pt-2">
              <button
                id="simulate-crash-btn"
                onClick={handleSimulateCrash}
                disabled={isSimulating}
                className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 p-[1px] focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-rose-600/25 active:scale-[0.99] disabled:opacity-60"
              >
                <div className="w-full h-full bg-slate-950/90 hover:bg-slate-950/70 transition-colors py-4 px-6 rounded-xl flex items-center justify-center gap-3">
                  {isSimulating ? (
                    <>
                      <RefreshCw className="w-5 h-5 text-rose-400 animate-spin" />
                      <span className="font-semibold text-white tracking-wide">
                        Simulating Crash & Flusing Sentry...
                      </span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform duration-300" />
                      <span className="font-bold text-base text-white tracking-wide">
                        Simulate Checkout Crash
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        HTTP 500
                      </span>
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Error Notification Alert */}
            {lastError && (
              <div className="mt-4 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold text-rose-300">500 Internal Server Error:</span>{" "}
                  <span className="font-mono text-rose-200">{lastError}</span>
                  <div className="mt-1 text-[11px] text-rose-400/80 font-mono">
                    Captured by Sentry SDK & available to Switch Log Agent for diagnosis.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Incident Stream / History */}
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Incident Telemetry Stream
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Real-time Events
              </span>
            </div>

            {incidentHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Activity className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
                <p className="text-xs">No simulated incidents triggered yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Click the crash button above to dispatch a deliberate error.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
                {incidentHistory.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400 font-bold">{inc.id}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-amber-300/90">{inc.service}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Clock className="w-3 h-3" />
                        <span>{inc.timestamp}</span>
                      </div>
                    </div>
                    <div className="text-slate-200 font-sans font-medium line-clamp-1">
                      {inc.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 text-slate-400/90 truncate">
                      {inc.detail}
                    </div>
                    {inc.eventId && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-cyan-400/80">
                        <span>Sentry Event ID:</span>
                        <code className="bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 text-cyan-300">
                          {inc.eventId}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Switch Log Agent Chat & Protocol Bridge (5 cols) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          {/* Agent Chat Preview Card */}
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden shadow-xl min-h-[480px]">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    Log Agent
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Switch Agent Protocol • Gemini + Sentry Tool
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>ONLINE</span>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px]">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 px-1">
                    <span>{m.role === "user" ? "You" : "Log Agent"}</span>
                    <span>•</span>
                    <span>{m.time}</span>
                  </div>
                  <div
                    className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs ${
                      m.role === "user"
                        ? "bg-rose-600/90 text-white shadow-sm"
                        : "bg-slate-950/80 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed shadow-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {isAgentLoading && (
                <div className="flex items-start">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Querying Sentry REST API & diagnosing root cause...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendAgentMessage}
              className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
            >
              <input
                type="text"
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                placeholder="Ask the Log Agent about recent crashes..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                type="submit"
                disabled={isAgentLoading || !agentInput.trim()}
                className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
                title="Send to Switch Agent API"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Switch Console Integration Info */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Switch Integration Endpoint
              </span>
              <span className="text-[10px] font-mono text-slate-500">v1.0</span>
            </div>
            <p className="text-[11px] text-slate-400">
              This API complies with the Switch Agent Protocol specification. In Switch Console, register:
            </p>
            <div className="font-mono text-[11px] bg-slate-950 px-3 py-2 rounded-lg border border-slate-800/80 text-cyan-300 flex items-center justify-between">
              <span>POST http://localhost:3000/api/agent</span>
              <span className="text-slate-500 text-[10px]">JSON payload</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Loaded via <code className="text-slate-400">switch-config/incident-room.yaml</code> in your Switch workspace.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
