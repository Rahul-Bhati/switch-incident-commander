import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let customReason = "Database connection timeout in cart-service: pool exhausted after 30000ms";
    try {
      const body = await req.json();
      if (body?.reason) {
        customReason = body.reason;
      }
    } catch {
      // JSON parsing optional, fallback to default reason
    }

    // Build the deliberate simulated crash error
    const simulatedError = new Error(customReason);
    simulatedError.name = "DatabaseTimeoutError";
    simulatedError.stack = `DatabaseTimeoutError: ${customReason}
    at checkoutCart (cart_service.ts:142:23)
    at processPayment (checkout_controller.ts:88:17)
    at executeOrderPipeline (order_pipeline.ts:215:9)
    at async POST (app/api/trigger/route.ts:24:5)`;

    // Capture in Sentry
    const eventId = Sentry.captureException(simulatedError, {
      tags: {
        environment: process.env.NODE_ENV || "development",
        service: "cart-service",
        simulated: "true",
        incident_type: "checkout_crash",
      },
      extra: {
        route: "/api/trigger",
        simulatedAt: new Date().toISOString(),
        host: req.headers.get("host") || "localhost",
      },
    });

    console.error("[Chaos Simulation] Deliberate checkout crash triggered:", simulatedError.message, "Sentry Event ID:", eventId);

    // Ensure Sentry events are flushed if running in serverless environment
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await Sentry.flush(2000).catch(() => null);
    }

    // Deliberately return 500 Internal Server Error
    return NextResponse.json(
      {
        success: false,
        error: simulatedError.message,
        name: simulatedError.name,
        eventId: eventId || "sentry-event-mock-" + Date.now(),
        service: "cart-service",
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    Sentry.captureException(error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
