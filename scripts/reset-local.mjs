import { rm, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { existsSync, lstatSync } from "node:fs";
import { requireFreePorts } from "./runtime.mjs";
async function resetLocal() {
  await requireFreePorts([4174, 8080, 9199, 4000, 9150, 4410, 4510]);
  const root = await realpath(process.cwd());
  const target = resolve(root, ".runtime/emulator-data");
  const rel = relative(root, target);
  if (!rel || rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Reset path must stay inside this worktree.");
  if (
    existsSync(resolve(root, ".runtime")) &&
    lstatSync(resolve(root, ".runtime")).isSymbolicLink()
  )
    throw new Error("Refusing to reset a linked runtime directory.");
  if (
    existsSync(target) &&
    (lstatSync(target).isSymbolicLink() || (await realpath(target)) !== target)
  )
    throw new Error("Refusing to reset a linked emulator snapshot.");
  await rm(target, { recursive: true, force: true });
  console.log(
    "Local emulator snapshot reset. Run npm run dev to restore synthetic data.",
  );
  console.log(
    "For a signed-out local log, clear only this environment's browser storage if desired.",
  );
}
try {
  await resetLocal();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
