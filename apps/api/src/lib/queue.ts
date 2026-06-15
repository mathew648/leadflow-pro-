import { Queue, Worker, QueueEvents, type ConnectionOptions } from "bullmq";
import { getRedis } from "./redis.js";

const connection = (): ConnectionOptions => getRedis() as unknown as ConnectionOptions;

// Queue names
export const QUEUES = {
  AUTOMATIONS: "automations",
  NOTIFICATIONS: "notifications",
  AI_SCORING: "ai-scoring",
  PDF_GENERATION: "pdf-generation",
  ACCOUNTING_SYNC: "accounting-sync",
  WEBHOOKS: "webhooks",
  EMAIL: "email",
  SMS: "sms",
} as const;

// Queue instances (lazy init)
const queues: Record<string, Queue> = {};

export function getQueue(name: string): Queue {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: connection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400, count: 100 },
        removeOnFail: { age: 7 * 86400 },
      },
    });
  }
  return queues[name];
}

// Typed job payloads
export interface AutomationJobPayload {
  tenantId: string;
  triggerType: string;
  entityType: string;
  entityId: string;
  entityData?: Record<string, unknown>;
}

export interface NotificationPayload {
  tenantId: string;
  userId?: string;
  type: "push" | "in_app";
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  tenantId?: string;
  /** Named template rendered by email.service. Defaults to "custom" when html is absent. */
  template?: string;
  /** Data passed to the template renderer. */
  data?: Record<string, unknown>;
  /** Pre-rendered HTML. When provided, takes precedence over template. */
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** When set, the Message row is updated with delivery status. */
  messageId?: string;
  attachments?: { filename: string; content: Buffer | string; contentType: string }[];
}

export interface SmsPayload {
  to: string;
  body: string;
  tenantId: string;
  /** When set, the Message row is updated with delivery status. */
  messageId?: string;
}

export interface AIScoringPayload {
  tenantId: string;
  leadId: string;
}

export interface PdfPayload {
  tenantId: string;
  type: "quote" | "invoice";
  entityId: string;
  /** When set, a "document ready" email is queued to this address after generation. */
  sendToEmail?: string;
}

export interface AccountingSyncPayload {
  tenantId: string;
  provider: "xero" | "myob" | "quickbooks";
  /** Set for a single-entity sync. Omit (with fullSync) for a full reconciliation. */
  entityType?: "customer" | "invoice" | "payment";
  entityId?: string;
  action?: "create" | "update" | "delete";
  /** When true, runs a full reconciliation rather than a single entity. */
  fullSync?: boolean;
}

const isTest = () => process.env.NODE_ENV === "test";

// Helper to enqueue jobs
export async function enqueueAutomation(payload: AutomationJobPayload) {
  if (isTest()) return;
  await getQueue(QUEUES.AUTOMATIONS).add("evaluate", payload);
}

export async function enqueueEmail(payload: EmailPayload) {
  if (isTest()) return;
  await getQueue(QUEUES.EMAIL).add("send", payload);
}

export async function enqueueSms(payload: SmsPayload) {
  if (isTest()) return;
  await getQueue(QUEUES.SMS).add("send", payload);
}

export async function enqueueAIScoring(payload: AIScoringPayload) {
  if (isTest()) return;
  await getQueue(QUEUES.AI_SCORING).add("score", payload, {
    delay: 2000,
  });
}

export async function enqueuePdf(payload: PdfPayload) {
  if (isTest()) return null;
  return getQueue(QUEUES.PDF_GENERATION).add("generate", payload);
}

export async function enqueueAccountingSync(payload: AccountingSyncPayload) {
  if (isTest()) return;
  await getQueue(QUEUES.ACCOUNTING_SYNC).add("sync", payload, {
    delay: 5000,
  });
}

export async function enqueueDelayed(
  queue: string,
  jobName: string,
  data: unknown,
  delayMs: number
) {
  if (isTest()) return;
  await getQueue(queue).add(jobName, data, { delay: delayMs });
}
