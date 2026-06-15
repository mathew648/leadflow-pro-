import { prisma } from "./prisma.js";
import type { FastifyRequest } from "fastify";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "send"
  | "approve"
  | "reject";

export type AuditEntityType =
  | "lead"
  | "customer"
  | "job"
  | "quote"
  | "invoice"
  | "payment"
  | "user"
  | "tenant"
  | "automation";

interface AuditLogOptions {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(opts: AuditLogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: opts.tenantId,
        actorId: opts.actorId,
        actorEmail: opts.actorEmail,
        actorRole: opts.actorRole,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        changes: opts.changes as any,
        metadata: (opts.metadata ?? {}) as any,
        ipAddress: opts.ipAddress,
        userAgent: opts.userAgent,
      },
    });
  } catch {
    // Audit log failures must never crash the main flow
  }
}

export function auditFromRequest(
  request: FastifyRequest,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId?: string,
  changes?: Record<string, unknown>
): Promise<void> {
  const r = request as any;
  return writeAuditLog({
    tenantId: r.tenantId ?? "",
    actorId: r.userId ?? "",
    actorEmail: r.jwtUser?.email ?? "",
    actorRole: r.jwtUser?.role ?? "",
    action,
    entityType,
    entityId,
    changes,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  });
}
