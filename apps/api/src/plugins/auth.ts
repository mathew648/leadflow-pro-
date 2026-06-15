import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

export interface JWTPayload {
  sub: string;   // userId
  tid: string;   // tenantId
  email: string;
  role: string;
  name: string;
  type?: string;
  jti?: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    jwtUser: JWTPayload;
    tenantId: string;
    userId: string;
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
    sign: {
      expiresIn: config.JWT_ACCESS_EXPIRY,
      algorithm: "HS256",
    },
    verify: {
      algorithms: ["HS256"],
    },
    cookie: {
      cookieName: "refreshToken",
      signed: false,
    },
  });

  // Decorator: verify JWT and attach user to request
  fastify.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        request.jwtUser = request.user as JWTPayload;
        request.tenantId = request.user.tid;
        request.userId = request.user.sub;
      } catch (err) {
        return reply.status(401).send({
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
        });
      }
    }
  );

  // Decorator: require specific roles
  fastify.decorate(
    "requireRole",
    function requireRole(roles: string[]) {
      return async function (request: FastifyRequest, reply: FastifyReply) {
        if (!request.jwtUser) {
          return reply.status(401).send({
            error: { code: "UNAUTHORIZED", message: "Authentication required" },
          });
        }
        if (!roles.includes(request.jwtUser.role)) {
          return reply.status(403).send({
            error: { code: "FORBIDDEN", message: "Insufficient permissions" },
          });
        }
      };
    }
  );
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
