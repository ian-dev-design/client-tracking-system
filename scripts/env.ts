// Load .env.local the same way Next.js does, before anything else is imported.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
