import { spawn, spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve, dirname } from "node:path";
export function runtimeEnv() {
  const env = { ...process.env };
  const separator = process.platform === "win32" ? ";" : ":";
  const inheritedPath = process.env.PATH || process.env.Path || "";
  for (const key of Object.keys(env))
    if (key.toLowerCase() === "path") delete env[key];
  env.PATH = `${dirname(process.execPath)}${separator}${inheritedPath}`;
  const runtime = resolve(".runtime");
  if (existsSync(runtime)) {
    const java = readdirSync(runtime).find(
      (name) =>
        /^(jdk|jre)-21/.test(name) &&
        existsSync(
          resolve(
            runtime,
            name,
            "bin",
            process.platform === "win32" ? "java.exe" : "java",
          ),
        ),
    );
    if (java) {
      env.JAVA_HOME = resolve(runtime, java);
      env.PATH = `${resolve(env.JAVA_HOME, "bin")}${process.platform === "win32" ? ";" : ":"}${env.PATH || ""}`;
    }
  }
  const cache = resolve(runtime, "firebase-emulators");
  if (existsSync(cache)) env.FIREBASE_EMULATORS_PATH = cache;
  const result = spawnSync("java", ["-version"], {
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  const major = /version "(\d+)/.exec(
    result.stderr || result.stdout || "",
  )?.[1];
  if (result.error || !major || Number(major) < 21)
    throw new Error(
      "Java 21+ is required. Install Temurin 21 and add bin to PATH (or place a JRE in .runtime/jdk-21*/bin).",
    );
  return env;
}
export async function requireFreePorts(ports) {
  for (const port of ports)
    await new Promise((accept, reject) => {
      const server = createServer();
      server.once("error", () =>
        reject(
          new Error(
            `Port ${port} is occupied. Stop the other server; no existing emulator will be reused or reset.`,
          ),
        ),
      );
      server.listen({ port, host: "127.0.0.1", exclusive: true }, () =>
        server.close(accept),
      );
    });
}
export function runFirebase(args, env) {
  const child = spawn(
    process.execPath,
    [resolve("node_modules/firebase-tools/lib/bin/firebase.js"), ...args],
    { stdio: "inherit", env, windowsHide: true },
  );
  const ignoreInterrupt = () => {};
  process.on("SIGINT", ignoreInterrupt);
  return new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.off("SIGINT", ignoreInterrupt);
      if (code === 0) accept();
      else reject(new Error(`Firebase CLI exited with ${code}.`));
    });
  });
}
