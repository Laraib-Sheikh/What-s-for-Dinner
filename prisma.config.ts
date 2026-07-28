import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config({ path: ".env" });

const rawUrl = process.env.DATABASE_URL || "";
const connectionString = rawUrl
  .replace(/[&?]channel_binding=[^&]*/g, "")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: connectionString,
  },
});
