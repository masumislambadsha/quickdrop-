import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` runs from the postinstall hook during Vercel builds, where
// runtime env vars are not injected. It only parses the schema and never opens
// a connection, so a syntactically valid placeholder is enough to keep the
// build from failing on a missing DATABASE_URL.
const PLACEHOLDER_DATABASE_URL =
	"postgresql://user:password@localhost:5432/placeholder";

export default defineConfig({
	schema: "prisma/schema",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: process.env.DATABASE_URL ?? PLACEHOLDER_DATABASE_URL,
	},
});
