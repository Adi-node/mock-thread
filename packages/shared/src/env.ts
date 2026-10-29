import { z } from "zod";

// one schema place per §13.1, parsed once per process
const EnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
  // Tests can use a stub provider, so this is optional.
  GEMINI_API_KEY: z.string().min(1).optional(),
  // TURN is not configured in every environment.
  TURN_SECRET: z.string().min(1).optional(),
  // Engine configuration is only required by deployments that run the worker.
  ENGINE_URL: z.string().url().optional(),
  ENGINE_API_KEY: z.string().min(1).optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // fail-fast: list every missing/invalid var, then throw. Never log secret values.
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = loadEnv(); // importing modules get a validated object immediately
