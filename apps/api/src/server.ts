import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { connectMongo } from "./db/mongoose.js";
import { ensureAdminUser } from "./services/adminService.js";
import { ensureSettings } from "./services/settingsService.js";
import { seedDataSources } from "./services/dataSourceService.js";
import { startScheduler, stopScheduler } from "./services/schedulerService.js";

async function main() {
  await connectMongo();
  await ensureSettings();
  await ensureAdminUser();
  await seedDataSources();
  startScheduler();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Holmes UI API listening on ${env.PORT}`);
  });

  const shutdown = () => {
    stopScheduler();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
