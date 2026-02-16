/**
 * RSYNC adapter — spawns rsync binary. Best for large dirs and incremental sync.
 */

import type { ProtocolAdapter } from "../types.js";
import { spawn } from "child_process";

export const rsyncAdapter: ProtocolAdapter = {
  name: "rsync",
  description: "RSYNC — efficient sync, delta transfer, great for large/directories",

  async available(): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn("rsync", ["--version"], { stdio: "pipe" });
      p.on("error", () => resolve(false));
      p.on("exit", (code) => resolve(code === 0));
    });
  },

  async transfer(source, destination, options) {
    const args: string[] = [];
    if (options.recursive) args.push("-r");
    if (options.progress) args.push("--progress");
    args.push("-a", "--no-perms", source, destination);

    await new Promise<void>((resolve, reject) => {
      const p = spawn("rsync", args, { stdio: "inherit" });
      p.on("error", reject);
      p.on("exit", (code, sig) => {
        if (code === 0) resolve();
        else reject(new Error(`rsync exited ${code ?? sig}`));
      });
    });
  },
};
