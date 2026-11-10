import { NextRequest, NextResponse } from "next/server";
import { runIncidentCommander, AgentChatMessage } from "@/lib/agent/commander";

export const dynamic = "force-dynamic";

/**
 * CORS headers to allow Switch Console and external chat clients
 * to communicate with the Log Agent API.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Switch-Room-Id, X-Switch-Agent-Id",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Switch Agent Protocol POST Endpoint
 * Expects: { messages: [{ role: "user", content: "..." }] }
 * Returns: { role: "assistant", content: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          role: "assistant",
          content: "Invalid JSON payload received by Switch Agent endpoint.",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = rawBody as {
      messages?: Array<{ role?: string; content?: string }>;
      prompt?: string;
      message?: string;
    };

    // Normalize messages according to Switch Agent Protocol
    let messages: AgentChatMessage[] = [];

    if (Array.isArray(payload?.messages) && payload.messages.length > 0) {
      messages = payload.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
        content: String(m.content ?? ""),
      }));
    } else if (payload?.prompt || payload?.message) {
      messages = [
        {
          role: "user",
          content: String(payload.prompt || payload.message),
        },
      ];
    } else {
      messages = [
        {
          role: "user",
          content: "Investigate any recent server crashes or errors.",
        },
      ];
    }

    // Pass messages to the LangChain Incident Commander agent
    const agentResponse = await runIncidentCommander(messages);

    return NextResponse.json(
      {
        role: "assistant",
        content: agentResponse,
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[Switch Agent API Bridge Error]:", error);

    return NextResponse.json(
      {
        role: "assistant",
        content: `Log Agent internal error: ${error.message}`,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      agent: "Log Agent",
      version: "1.0.0",
      protocol: "Switch Agent Protocol",
      description: "Incident Command Center Log Agent powered by LangChain and Google Gemini",
    },
    { headers: corsHeaders }
  );
}
