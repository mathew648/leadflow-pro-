import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";

export interface TestTenant {
  tenantId: string;
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  stageId: string;
}

let counter = 0;

export async function seedTenant(app: FastifyInstance): Promise<TestTenant> {
  const suffix = `${Date.now()}-${++counter}`;
  const email = `owner-${suffix}@test.example`;
  const password = "TestPass123!abc";

  const tenant = await prisma.tenant.create({
    data: {
      slug: `test-tenant-${suffix}`,
      businessName: "Test Co",
      email: `info-${suffix}@test.example`,
      country: "AU",
      status: "active",
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      passwordHash,
      firstName: "Test",
      lastName: "Owner",
      role: "owner",
      status: "active",
    },
  });

  await prisma.tenantSettings.create({ data: { tenantId: tenant.id } });

  const stage = await prisma.pipelineStage.create({
    data: {
      tenantId: tenant.id,
      name: "New",
      slug: "new",
      color: "#3B82F6",
      position: 0,
      isDefault: true,
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });

  const body = res.json();
  const accessToken: string = body?.data?.accessToken ?? body?.accessToken ?? "";

  return {
    tenantId: tenant.id,
    userId: user.id,
    email,
    password,
    accessToken,
    stageId: stage.id,
  };
}

export async function cleanupTenant(tenantId: string): Promise<void> {
  await prisma.workflowExecution.deleteMany({ where: { tenantId } });
  await prisma.workflowStep.deleteMany({ where: { tenantId } });
  await prisma.automationWorkflow.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.quoteLineItem.deleteMany({ where: { quote: { tenantId } } });
  await prisma.quote.deleteMany({ where: { tenantId } });
  await prisma.jobTask.deleteMany({ where: { job: { tenantId } } });
  await prisma.jobChecklistItem.deleteMany({ where: { checklist: { job: { tenantId } } } });
  await prisma.jobChecklist.deleteMany({ where: { job: { tenantId } } });
  await prisma.jobMaterial.deleteMany({ where: { job: { tenantId } } });
  await prisma.jobPhoto.deleteMany({ where: { job: { tenantId } } });
  await prisma.timeEntry.deleteMany({ where: { tenantId } });
  await prisma.job.deleteMany({ where: { tenantId } });
  await prisma.leadActivity.deleteMany({ where: { lead: { tenantId } } });
  await prisma.lead.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.contact.deleteMany({ where: { tenantId } });
  await prisma.property.deleteMany({ where: { tenantId } });
  await prisma.message.deleteMany({ where: { tenantId } });
  await prisma.catalogItem.deleteMany({ where: { tenantId } });
  await prisma.catalogCategory.deleteMany({ where: { tenantId } });
  await prisma.leadSourceConfig.deleteMany({ where: { tenantId } });
  await prisma.pipelineStage.deleteMany({ where: { tenantId } });
  const userIds = await prisma.user.findMany({ where: { tenantId }, select: { id: true } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds.map((u) => u.id) } } });
  await prisma.tenantSettings.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.accountingConnection.deleteMany({ where: { tenantId } });
  await prisma.locationPing.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}
