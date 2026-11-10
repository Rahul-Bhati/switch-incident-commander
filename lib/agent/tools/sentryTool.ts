import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

interface SentryIssue {
  id: string;
  title: string;
  culprit?: string;
  permalink?: string;
  firstSeen?: string;
  lastSeen?: string;
  count?: string | number;
  metadata?: {
    type?: string;
    value?: string;
    filename?: string;
  };
}

interface SentryFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  context?: Array<[number, string]>;
  inApp?: boolean;
}

interface SentryEvent {
  id: string;
  message?: string;
  title?: string;
  dateCreated?: string;
  entries?: Array<{
    type: string;
    data?: {
      values?: Array<{
        type?: string;
        value?: string;
        stacktrace?: {
          frames?: SentryFrame[];
        };
        rawStacktrace?: {
          frames?: SentryFrame[];
        };
      }>;
    };
  }>;
  stacktrace?: {
    frames?: SentryFrame[];
  };
}

/**
 * Extracts the top failing frames from a Sentry event payload.
 * Sentry orders frames caller -> callee, so the most immediate failing frames
 * are located at the end of the frames list.
 */
function extractTopFailingFrames(event: SentryEvent, count: number = 3): SentryFrame[] {
  let frames: SentryFrame[] = [];

  // Check structured exception entries
  const exceptionEntry = event.entries?.find((entry) => entry.type === "exception");
  if (exceptionEntry?.data?.values && exceptionEntry.data.values.length > 0) {
    const latestException = exceptionEntry.data.values[exceptionEntry.data.values.length - 1];
    frames = latestException.stacktrace?.frames || latestException.rawStacktrace?.frames || [];
  }

  // Fallback to top-level stacktrace if present
  if (frames.length === 0 && event.stacktrace?.frames) {
    frames = event.stacktrace.frames;
  }

  // In Sentry, the deepest (most recent / failing) frames are at the tail
  return frames.slice(-count).reverse();
}

/**
 * Formats extracted frames into human-readable Markdown with code snippets.
 */
function formatFramesMarkdown(frames: SentryFrame[]): string {
  if (!frames || frames.length === 0) {
    return "_No stack trace frames recorded for this event._\n";
  }

  return frames
    .map((frame, index) => {
      const file = frame.filename || "unknown_file";
      const fn = frame.function || "<anonymous>";
      const line = frame.lineno !== undefined ? `:${frame.lineno}` : "";
      const col = frame.colno !== undefined ? `:${frame.colno}` : "";

      let snippetText = "";
      if (frame.context && frame.context.length > 0) {
        snippetText = frame.context
          .map(([lineNum, code]) => {
            const isFailingLine = lineNum === frame.lineno ? ">>" : "  ";
            return `${isFailingLine} ${String(lineNum).padStart(4, " ")} | ${code}`;
          })
          .join("\n");
      }

      return `**Frame ${index + 1}:** \`${file}${line}${col}\` in \`${fn}\`\n${
        snippetText ? "```typescript\n" + snippetText + "\n```\n" : ""
      }`;
    })
    .join("\n");
}

/**
 * Provides deterministic mock data for simulation when Sentry credentials
 * have not yet been provided in .env.local.
 */
function getSimulatedCrashReport(): string {
  return `### [SIMULATED SENTRY ISSUE] DatabaseTimeoutError: Database connection timeout in cart-service
- **Issue ID:** \`SIM-104928\`
- **Status:** Unresolved
- **Culprit:** \`cart_service.ts in checkoutCart\`
- **Service:** \`cart-service\`
- **Error:** \`Database connection timeout in cart-service: pool exhausted after 30000ms\`
- **Last Seen:** ${new Date().toISOString()}

#### Top 3 Failing Frames:
**Frame 1:** \`cart_service.ts:142:23\` in \`checkoutCart\`
\`\`\`typescript
   140 |   const client = await pool.connect();
   141 |   // Timeout waiting for active client connection from pool
>> 142 |   await client.query("SELECT * FROM cart_items WHERE session_id = $1 FOR UPDATE", [sessionId]);
   143 |   return calculateTotal(client);
\`\`\`

**Frame 2:** \`checkout_controller.ts:88:17\` in \`processPayment\`
\`\`\`typescript
    86 |   log.info("Processing order payment sequence");
    87 |   // Acquiring cart items lock
>>  88 |   const cart = await cartService.checkoutCart(req.sessionId);
    89 |   return paymentGateway.charge(cart);
\`\`\`

**Frame 3:** \`order_pipeline.ts:215:9\` in \`executeOrderPipeline\`
\`\`\`typescript
   213 |   try {
   214 |     await validateInventory(items);
>> 215 |     await processPayment(context);
   216 |   } catch (err) {
\`\`\`

> *Notice: Using simulated telemetry because SENTRY_AUTH_TOKEN, SENTRY_ORG, or SENTRY_PROJECT is not yet populated in .env.local. Populate these variables to query your live Sentry organization.*`;
}

/**
 * DynamicStructuredTool to fetch recent Sentry errors and inspect stack traces.
 */
export const sentryTool = new DynamicStructuredTool({
  name: "fetch_recent_sentry_errors",
  description:
    "Queries the Sentry REST API to retrieve recent unresolved issues and their latest stack traces with failing frames, line numbers, and code snippets.",
  schema: z.object({
    limit: z
      .number()
      .optional()
      .default(3)
      .describe("Maximum number of recent unresolved issues to query (default: 3)"),
  }),
  func: async ({ limit = 3 }) => {
    const org = process.env.SENTRY_ORG?.trim();
    const project = process.env.SENTRY_PROJECT?.trim();
    const token = process.env.SENTRY_AUTH_TOKEN?.trim();

    // If credentials are absent or default placeholders, provide simulated telemetry
    if (!org || !project || !token || token.startsWith("sntrys_your_auth_token")) {
      return getSimulatedCrashReport();
    }

    try {
      // Step 1: GET recent unresolved issues
      const issuesUrl = `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(
        project
      )}/issues/?query=is:unresolved&limit=${encodeURIComponent(limit)}`;

      const issuesResponse = await fetch(issuesUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!issuesResponse.ok) {
        const errorText = await issuesResponse.text();
        return `⚠️ Sentry API query failed (HTTP ${issuesResponse.status}): ${errorText}\n\nFalling back to recent simulated crash report:\n\n${getSimulatedCrashReport()}`;
      }

      const issues: SentryIssue[] = await issuesResponse.json();

      if (!Array.isArray(issues) || issues.length === 0) {
        return `No unresolved issues found in Sentry project \`${org}/${project}\`. All services are currently reporting healthy.\n\nSimulated incident data for verification:\n\n${getSimulatedCrashReport()}`;
      }

      // Step 2: GET latest event stack trace for each issue
      const formattedReports = await Promise.all(
        issues.slice(0, limit).map(async (issue, idx) => {
          try {
            const eventUrl = `https://sentry.io/api/0/issues/${encodeURIComponent(issue.id)}/events/latest/`;
            const eventResponse = await fetch(eventUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });

            if (!eventResponse.ok) {
              return `### Issue ${idx + 1}: ${issue.title} (ID: ${issue.id})\n- **Status:** Unresolved\n- **Culprit:** ${
                issue.culprit || "unknown"
              }\n- *Could not retrieve latest event stack trace (HTTP ${eventResponse.status})*\n`;
            }

            const event: SentryEvent = await eventResponse.json();
            const topFrames = extractTopFailingFrames(event, 3);
            const framesMd = formatFramesMarkdown(topFrames);

            return `### Issue ${idx + 1}: ${issue.title} (ID: ${issue.id})
- **Status:** Unresolved
- **Culprit:** \`${issue.culprit || issue.metadata?.value || "unknown"}\`
- **Events Count:** ${issue.count || 1}
- **First Seen:** ${issue.firstSeen || "N/A"}
- **Last Seen:** ${issue.lastSeen || "N/A"}
- **Link:** ${issue.permalink || "N/A"}

#### Top 3 Failing Frames:
${framesMd}
`;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return `### Issue ${idx + 1}: ${issue.title} (ID: ${issue.id})\n- *Error fetching stack trace: ${msg}*\n`;
          }
        })
      );

      return formattedReports.join("\n---\n\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `⚠️ Unexpected network error while communicating with Sentry REST API: ${msg}\n\nFallback simulated report:\n\n${getSimulatedCrashReport()}`;
    }
  },
});
