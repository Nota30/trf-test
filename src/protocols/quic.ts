/**
 * QUIC transfer — uses external tool or HTTP/3 where available.
 * Native QUIC in Node/Bun is limited; we spawn curl (if built with HTTP/3) or suggest alternative.
 */

import type { ProtocolAdapter } from "../types.js";
import { spawn } from "child_process";

export const quicAdapter: ProtocolAdapter = {
  name: "quic",
  description: "QUIC (HTTP/3) — low-latency, multiplexed; requires HTTP/3 server",

  async available(): Promise<boolean> {
    // Check for curl with HTTP/3 (--http3)
    return new Promise((resolve) => {
      const p = spawn("curl", ["--version"], { stdio: "pipe" });
      let out = "";
      p.stdout?.on("data", (d) => (out += d.toString()));
      p.on("error", () => resolve(false));
      p.on("exit", (code) => {
        resolve(code === 0 && out.includes("HTTP3"));
      });
    });
  },

  async transfer(source, destination, options) {
    // destination = https://host/path (QUIC endpoint)
    const url = destination.startsWith("http") ? destination : `https://${destination}`;
    const args = ["--http3", "-T", source, url];
    if (options.progress) args.push("--progress-bar");

    await new Promise<void>((resolve, reject) => {
      const p = spawn("curl", args, { stdio: "inherit" });
      p.on("error", reject);
      p.on("exit", (code, sig) => {
        if (code === 0) resolve();
        else reject(new Error(`curl (QUIC) exited ${code ?? sig}. Ensure server supports HTTP/3.`));
      });
    });
  },
};
