import { createServer } from "vite";
import { seedLocal } from "./seed-local.mjs";
import { writeMockCsv } from "./mock-data.mjs";
try {
  await seedLocal();
  await writeMockCsv();
  const server = await createServer({
    mode: "emulator",
    server: { host: "127.0.0.1", port: 4174, strictPort: true },
  });
  await server.listen();
  server.printUrls();
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
