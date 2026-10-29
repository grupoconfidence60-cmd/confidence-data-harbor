import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.LOVABLE_DB_MIGRATION_URL?.trim();
  if (!url) {
    throw new Error(
      "Configure LOVABLE_DB_MIGRATION_URL com a conexão de migração antes de aplicar as alterações. Nenhuma migração foi executada.",
    );
  }

  const client = postgres(url, { max: 1, connect_timeout: 15 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/migrations/", import.meta.url)),
    });
    console.log("Migrações aplicadas, incluindo o armazenamento de múltiplos supervisores por posto.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error(
    process.env.LOVABLE_DB_MIGRATION_URL?.trim()
      ? "Não foi possível concluir as migrações. Verifique a conexão de migração, suas permissões e os registros do banco antes de tentar novamente."
      : "Configure LOVABLE_DB_MIGRATION_URL com a conexão de migração. Nenhuma migração foi executada.",
  );
  process.exitCode = 1;
});
