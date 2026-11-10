"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-slate-950 text-slate-100 flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/50 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-white">Application Incident Encountered</h2>
          <p className="text-xs text-slate-400">
            A fatal client error occurred and was captured by Sentry for investigation.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
          >
            Attempt Recovery
          </button>
        </div>
      </body>
    </html>
  );
}
