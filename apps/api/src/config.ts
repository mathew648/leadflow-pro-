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
  EMAIL_FROM: z.string().default("LeadFlow Pro <noreply@leadflowpro.com>"),

  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  VONAGE_FROM_NUMBER: z.string().default("LeadFlow"),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("leadflow-dev"),
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
