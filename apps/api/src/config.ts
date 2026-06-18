import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(32).optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACCESS_EXPIRY: z.coerce.number().default(900),
  JWT_REFRESH_EXPIRY: z.coerce.number().default(2592000),

  ENCRYPTION_KEY: z.string().min(64).optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("TradieJet <info@tradiejet.com>"),

  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  VONAGE_FROM_NUMBER: z.string().default("TradieJet"),

  // Twilio WhatsApp (admin → tradie messaging).
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("tradiejet-dev"),
  R2_PUBLIC_URL: z.string().url().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  XERO_CLIENT_ID: z.string().optional(),
  XERO_CLIENT_SECRET: z.string().optional(),
  XERO_REDIRECT_URI: z.string().url().optional(),

  MYOB_CLIENT_ID: z.string().optional(),
  MYOB_CLIENT_SECRET: z.string().optional(),
  MYOB_REDIRECT_URI: z.string().url().optional(),
  MYOB_API_KEY: z.string().optional(),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_REDIRECT_URI: z.string().url().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000),
  RATE_LIMIT_MAX: z.coerce.number().default(1000),

  ENABLE_AI_FEATURES: z.string().transform((v) => v === "true").default("true"),

  // Comma-separated emails allowed into the platform admin panel (super-admins).
  PLATFORM_ADMIN_EMAILS: z.string().default(""),

  // Business-register lookups (auto-fill business details at signup).
  ABR_GUID: z.string().optional(),       // Australian Business Register ABN Lookup GUID (free)
  NZBN_API_KEY: z.string().optional(),   // NZBN API subscription key (Ocp-Apim-Subscription-Key)
  // NZBN production requires OAuth client-credentials in addition to the subscription key.
  NZBN_CLIENT_ID: z.string().optional(),
  NZBN_CLIENT_SECRET: z.string().optional(),
  NZBN_TOKEN_URL: z.string().default("https://api.business.govt.nz/services/token"),

  // Email-to-Lead — forward portal (Builderscrack/hipages/etc.) notification emails in.
  INBOUND_EMAIL_DOMAIN: z.string().default("in.tradiejet.com"),
  INBOUND_EMAIL_SECRET: z.string().optional(), // optional shared secret the mail service sends

  // Web Push (VAPID) — browser/PWA push notifications.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:info@tradiejet.com"),

  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default("development"),
});

type Env = z.infer<typeof envSchema>;

let _config: Env;

export function getConfig(): Env {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Invalid environment variables:");
      console.error(result.error.format());
      process.exit(1);
    }
    _config = result.data;
  }
  return _config;
}

export const config = new Proxy({} as Env, {
  get(_, key) {
    return getConfig()[key as keyof Env];
  },
});
