import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { config } from "../config.js";

export function initSentry(): void {
  if (!config.SENTRY_DSN) return;

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: config.NODE_ENV === "production" ? 0.2 : 1.0,
    profilesSampleRate: config.NODE_ENV === "production" ? 0.1 : 0.0,
    sendDefaultPii: false,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!config.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function setUserContext(userId: string, tenantId: string, email?: string): void {
  if (!config.SENTRY_DSN) return;
  Sentry.setUser({ id: userId, email });
  Sentry.setTag("tenantId", tenantId);
}

export function clearUserContext(): void {
  if (!config.SENTRY_DSN) return;
  Sentry.setUser(null);
}
