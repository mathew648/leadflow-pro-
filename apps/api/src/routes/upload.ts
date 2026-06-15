import { FastifyInstance } from "fastify";
import { z } from "zod";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { config } from "../config.js";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: config.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = ["application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export default async function uploadRoutes(fastify: FastifyInstance) {
  // POST /api/v1/upload/presigned  — get a presigned URL for direct-to-R2 upload
  fastify.post(
    "/upload/presigned",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        filename: z.string().min(1).max(200),
        contentType: z.string(),
        category: z.enum(["avatar", "logo", "job-photo", "document", "signature"]),
        entityId: z.string().uuid().optional(),
      }).parse(request.body);

      const isImage = ALLOWED_IMAGE_TYPES.includes(body.contentType);
      const isDoc = ALLOWED_DOC_TYPES.includes(body.contentType);

      if (!isImage && !isDoc) {
        return reply.status(422).send({
          error: { code: "INVALID_TYPE", message: "Unsupported file type" },
        });
      }

      const ext = body.filename.split(".").pop() ?? "bin";
      const key = `${request.tenantId}/${body.category}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

      const r2 = getR2Client();
      const command = new PutObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: key,
        ContentType: body.contentType,
        Metadata: {
          tenantId: request.tenantId,
          uploadedBy: request.userId,
          category: body.category,
        },
      });

      const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 min

      const publicUrl = `${config.R2_PUBLIC_URL}/${key}`;

      return reply.status(200).send({
        data: {
          uploadUrl: presignedUrl,
          publicUrl,
          key,
          expiresIn: 300,
        },
      });
    }
  );

  // POST /api/v1/upload/confirm  — confirm upload and persist to DB
  fastify.post(
    "/upload/confirm",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({
        key: z.string(),
        publicUrl: z.string().url(),
        category: z.enum(["avatar", "logo", "job-photo", "document", "signature"]),
        entityId: z.string().uuid().optional(),
        entityType: z.enum(["user", "tenant", "job", "quote", "invoice", "lead"]).optional(),
        caption: z.string().optional(),
      }).parse(request.body);

      if (body.category === "avatar" && body.entityType === "user") {
        const { prisma } = await import("../lib/prisma.js");
        await prisma.user.update({
          where: { id: request.userId },
          data: { avatarUrl: body.publicUrl },
        });
      }

      if (body.category === "logo" && body.entityType === "tenant") {
        const { prisma } = await import("../lib/prisma.js");
        await prisma.tenant.update({
          where: { id: request.tenantId },
          data: { logoUrl: body.publicUrl },
        });
      }

      if (body.category === "job-photo" && body.entityId) {
        const { prisma } = await import("../lib/prisma.js");
        await prisma.jobPhoto.create({
          data: {
            tenantId: request.tenantId,
            jobId: body.entityId,
            takenById: request.userId,
            url: body.publicUrl,
            caption: body.caption,
            takenAt: new Date(),
            type: "after",
          },
        });
      }

      return { data: { confirmed: true, url: body.publicUrl } };
    }
  );

  // DELETE /api/v1/upload
  fastify.delete(
    "/upload",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = z.object({ key: z.string() }).parse(request.body);

      // Security: ensure key belongs to this tenant
      if (!body.key.startsWith(request.tenantId + "/")) {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "Cannot delete file from another tenant" },
        });
      }

      const r2 = getR2Client();
      await r2.send(new DeleteObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: body.key }));

      return { data: { deleted: true } };
    }
  );
}
