/**
 * UDR (UDP-based Data Transfer) — spawns udr binary. Best for high-speed WAN.
 */

import type { ProtocolAdapter } from "../types.js";
import { spawn } from "child_process";

export const udrAdapter: ProtocolAdapter = {
  name: "udr",
  description: "UDR (UDT + rsync) — very fast over high-latency links",

  async available(): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn("udr", ["--version"], { stdio: "pipe" });
      p.on("error", () => resolve(false));
      p.on("exit", (code) => resolve(code === 0));
    });
  },

  async transfer(source, destination, options) {
    const args: string[] = [];
    if (options.recursive) args.push("-r");
    if (options.progress) args.push("--progress");
    args.push(source, destination);

    await new Promise<void>((resolve, reject) => {
      const p = spawn("udr", args, { stdio: "inherit" });
      p.on("error", reject);
      p.on("exit", (code, sig) => {
        if (code === 0) resolve();
        else reject(new Error(`udr exited ${code ?? sig}`));
      });
    });
  },
};
