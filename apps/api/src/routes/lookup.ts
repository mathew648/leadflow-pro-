import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";

/**
 * Public business-register lookups used at signup to auto-fill a tradie's business
 * details (so they barely type anything). Unauthenticated (signup is pre-login) and
 * rate-limited. Degrades gracefully to manual entry when not configured.
 */
export default async function lookupRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/lookup/business",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const q = z.object({
        country: z.enum(["AU", "NZ"]),
        number: z.string().min(6).max(20),
      }).parse(request.query);
      const num = q.number.replace(/\s+/g, "");

      try {
        if (q.country === "AU") {
          if (!config.ABR_GUID) {
            return reply.status(503).send({ error: { code: "LOOKUP_UNAVAILABLE", message: "ABN lookup not configured" } });
          }
          // ABR returns JSONP: "callback({...})" — strip the wrapper.
          const res = await fetch(`https://abr.business.gov.au/json/AbnDetails.aspx?abn=${encodeURIComponent(num)}&guid=${config.ABR_GUID}`);
          const text = await res.text();
          const jsonStr = text.replace(/^[^(]*\(/, "").replace(/\)\s*;?\s*$/, "");
          const j = JSON.parse(jsonStr) as any;
          if (j.Message) {
            return reply.status(404).send({ error: { code: "NOT_FOUND", message: j.Message } });
          }
          const name = j.EntityName || (Array.isArray(j.BusinessName) ? j.BusinessName[0] : "") || "";
          return {
            data: {
              name,
              state: j.AddressState ?? null,
              postcode: j.AddressPostcode ?? null,
              gstRegistered: Boolean(j.Gst),
              number: j.Abn ?? num,
            },
          };
        }

        // NZ
        if (!config.NZBN_API_KEY) {
          return reply.status(503).send({ error: { code: "LOOKUP_UNAVAILABLE", message: "NZBN lookup not configured" } });
        }
        const res = await fetch(`https://api.business.govt.nz/services/v5/nzbn/entities/${encodeURIComponent(num)}`, {
          headers: { "Ocp-Apim-Subscription-Key": config.NZBN_API_KEY, Accept: "application/json" },
        });
        if (!res.ok) {
          return reply.status(404).send({ error: { code: "NOT_FOUND", message: "NZBN not found" } });
        }
        const j = (await res.json()) as any;
        const addr = (j.addresses?.addressList ?? [])[0] ?? {};
        return {
          data: {
            name: j.entityName ?? "",
            state: addr.address4 ?? null,
            postcode: addr.postCode ?? null,
            gstRegistered: null,
            number: j.nzbn ?? num,
          },
        };
      } catch {
        return reply.status(502).send({ error: { code: "LOOKUP_FAILED", message: "Could not reach the business register" } });
      }
    }
  );
}
