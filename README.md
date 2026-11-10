# Switch Incident Command Center

A full-stack Next.js (App Router) application integrating **Sentry error monitoring** and the **Switch open-source agent framework** with **LangChain.js** and **Google Gemini**.

The system provides:
1. **The Chaos Dashboard:** A minimalist, dark-themed UI to trigger deliberate server errors (`500 Internal Server Error`) captured by Sentry.
2. **The Switch Log Agent:** An AI-powered incident commander connected to Slack/Teams via the Switch Agent Protocol that inspects Sentry stack traces, extracts top failing frames, and diagnoses root causes in real-time.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Slack / Teams Incident Room       │
                      └──────────────────┬───────────────────┘
                                         │
                                         ▼ (Switch Agent Protocol)
┌─────────────────────────┐    ┌───────────────────────────────────┐
│     Chaos Dashboard     │    │   Switch Agent Webhook Bridge     │
│       (app/page.tsx)    │    │      (app/api/agent/route.ts)     │
└────────────┬────────────┘    └─────────────────┬─────────────────┘
             │                                   │
             ▼                                   ▼
┌─────────────────────────┐    ┌───────────────────────────────────┐
│ Chaos Trigger Endpoint  │    │      LangChain Incident Agent     │
│ (app/api/trigger/route) │    │      (lib/agent/commander.ts)     │
└────────────┬────────────┘    └─────────────────┬─────────────────┘
             │                                   │
             │ (captures error)                  │ (fetches stack traces)
             ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Sentry Error Monitoring                        │
│             (@sentry/nextjs & Sentry REST API)                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```text
/
├── app/
│   ├── page.tsx                  # Chaos Dashboard UI
│   ├── layout.tsx                # App layout & styling
│   ├── globals.css               # Tailwind CSS theme
│   ├── api/
│   │   ├── agent/route.ts        # Switch Agent Protocol webhook
│   │   └── trigger/route.ts      # Deliberate 500 error generator
├── lib/
│   ├── agent/
│   │   ├── commander.ts          # LangChain + Gemini Log Agent
│   │   └── tools/
│   │       └── sentryTool.ts     # Sentry REST API query tool
├── switch-config/
│   ├── incident-room.yaml        # Switch Console room config
│   └── incident-room.template.yaml
├── sentry.client.config.ts       # Sentry client instrumentation
├── sentry.server.config.ts       # Sentry server instrumentation
├── sentry.edge.config.ts         # Sentry edge instrumentation
├── package.json
└── .env.local
```

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node v22)
- npm or pnpm

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your keys:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Google Gemini API key for AI reasoning |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error ingestion |
| `SENTRY_AUTH_TOKEN` | Sentry auth token with `issue:read` permission |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `GEMINI_MODEL` | *(Optional)* Gemini model (default: `gemini-1.5-flash`) |

> **Offline/Demo Resilience:** If live Sentry or Gemini credentials are omitted during testing, the application includes a deterministic mock fallback so all UI flows and API contracts remain testable.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Chaos Dashboard.

---

## Features

### 1. The Chaos Dashboard (`/`)
- A dark-themed operations dashboard with a prominent **"Simulate Checkout Crash"** button.
- Triggers a call to `POST /api/trigger` returning an HTTP 500 with stack traces.
- Displays live incident telemetry and an embedded chat playground to test the Log Agent directly in the browser.

### 2. Sentry LangChain Tool (`lib/agent/tools/sentryTool.ts`)
A `DynamicStructuredTool` registered under `fetch_recent_sentry_errors` that executes:
1. `GET https://sentry.io/api/0/projects/{org}/{project}/issues/?query=is:unresolved&limit=3`
2. `GET https://sentry.io/api/0/issues/{issue_id}/events/latest/`
Formats and returns the top 3 failing frames with file, line number, and code context.

### 3. LangChain Incident Commander (`lib/agent/commander.ts`)
- Uses `ChatGoogleGenerativeAI` (`gemini-1.5-flash`).
- Binds `fetch_recent_sentry_errors`.
- Guided by the Incident Command Center system prompt to analyze root causes and provide remediation steps.

### 4. Switch Agent Protocol Endpoint (`app/api/agent/route.ts`)
- Implements `POST /api/agent`.
- Complies with Switch Agent Protocol JSON format:
  ```json
  // Request
  {
    "messages": [
      { "role": "user", "content": "What caused the checkout failure?" }
    ]
  }

  // Response
  {
    "role": "assistant",
    "content": "### Incident Root Cause Analysis..."
  }
  ```

### 5. Switch Console Integration (`switch-config/incident-room.yaml`)
Load this YAML into the Switch Console to deploy the **Log Agent** in Slack or Microsoft Teams:

```yaml
version: "1.0"
agents:
  - id: "log-agent"
    name: "Log Agent"
    endpoint: "http://localhost:3000/api/agent"
rooms:
  - id: "incident-command-center"
    name: "incident-command-center"
    participants:
      - id: "operator"
        role: "user"
      - id: "log-agent"
        role: "agent"
```

---

## Testing via CLI

### Trigger a simulated crash:
```bash
curl -X POST http://localhost:3000/api/trigger
```

### Query the Log Agent:
```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Investigate recent checkout crashes"}]}'
```
