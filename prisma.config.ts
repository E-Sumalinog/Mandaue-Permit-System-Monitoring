import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local if present, falling back to .env
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});