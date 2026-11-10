import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { sentryTool } from "./tools/sentryTool";

export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT =
  "You are the Log Agent for an Incident Command Center. When a human asks about a server crash or errors, you must use the `fetch_recent_sentry_errors` tool to pull the latest stack traces, summarize the root cause, and present it clearly in markdown.";

/**
 * Initializes and executes the LangChain Log Agent.
 * Complies with the Switch Agent Protocol message format.
 */
export async function runIncidentCommander(messages: AgentChatMessage[]): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  // Fallback if Google API key is missing
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.warn("[Log Agent] GOOGLE_API_KEY is not set. Executing tool directly for inspection.");
    const directToolResult = await sentryTool.invoke({ limit: 3 });
    return (
      "⚠️ **Log Agent Warning:** `GOOGLE_API_KEY` is not configured in `.env.local`.\n\n" +
      "However, the `fetch_recent_sentry_errors` tool was executed directly to verify your telemetry pipeline:\n\n" +
      directToolResult +
      "\n\n*Please add a valid `GOOGLE_API_KEY` to `.env.local` to enable Gemini AI reasoning and root-cause analysis.*"
    );
  }

  try {
    // Initialize Google Gemini model
    const llm = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: apiKey,
      temperature: 0.1,
    });

    // Bind the Sentry REST API tool to the Gemini model
    const modelWithTools = llm.bindTools([sentryTool]);

    // Construct the LangChain message history
    const conversation: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];

    for (const msg of messages) {
      if (msg.role === "user") {
        conversation.push(new HumanMessage(msg.content));
      } else if (msg.role === "assistant") {
        conversation.push(new AIMessage(msg.content));
      } else if (msg.role === "system") {
        conversation.push(new SystemMessage(msg.content));
      }
    }

    // Step 1: First model invocation
    let response = await modelWithTools.invoke(conversation);
    conversation.push(response);

    // Step 2: Handle tool calls if the model requests them
    let iterations = 0;
    const maxIterations = 5;

    while (response.tool_calls && response.tool_calls.length > 0 && iterations < maxIterations) {
      iterations++;
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === sentryTool.name) {
          const toolOutput = await sentryTool.invoke(toolCall.args);
          conversation.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "call_sentry_1",
              name: toolCall.name,
              content: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput),
            })
          );
        } else {
          conversation.push(
            new ToolMessage({
              tool_call_id: toolCall.id ?? "call_unknown",
              name: toolCall.name,
              content: `Unknown tool: ${toolCall.name}`,
            })
          );
        }
      }

      // Re-invoke the model with the tool output appended to the history
      response = await modelWithTools.invoke(conversation);
      conversation.push(response);
    }

    const finalContent = response.content;
    if (typeof finalContent === "string") {
      return finalContent;
    } else if (Array.isArray(finalContent)) {
      return finalContent
        .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
        .join("\n");
    }

    return String(finalContent);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Log Agent Execution Error]:", errorMsg);

    // Provide helpful diagnostic fallback
    return (
      `⚠️ **Log Agent Error:** An error occurred while communicating with the Gemini API (${errorMsg}).\n\n` +
      `Here is the latest data from the \`fetch_recent_sentry_errors\` tool:\n\n` +
      (await sentryTool.invoke({ limit: 3 }))
    );
  }
}
