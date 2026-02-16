/**
 * FTP adapter using basic-ftp.
 */

import { Client } from "basic-ftp";
import type { ProtocolAdapter } from "../types.js";
import { stat } from "fs/promises";
import { parseScpDestination } from "../parse-destination.js";

function parseFtpDestination(dest: string): { host: string; port: number; user: string; password: string; path: string } {
  // Support ftp://user:pass@host/path or user@host:path
  if (dest.startsWith("ftp://")) {
    try {
      const u = new URL(dest);
      return {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 21,
        user: u.username || "anonymous",
        password: u.password || "",
        path: u.pathname || "/",
      };
    } catch {
      throw new Error(`Invalid FTP URL: ${dest}`);
    }
  }
  const parsed = parseScpDestination(dest);
  if (!parsed) throw new Error(`Invalid FTP destination: ${dest}`);
  return {
    host: parsed.host,
    port: parsed.port ?? 21,
    user: parsed.user ?? "anonymous",
    password: process.env.FTP_PASSWORD ?? "",
    path: parsed.path,
  };
}

export const ftpAdapter: ProtocolAdapter = {
  name: "ftp",
  description: "FTP — classic, widely supported (unencrypted)",

  async available(): Promise<boolean> {
    try {
      await import("basic-ftp");
      return true;
    } catch {
      return false;
    }
  },

  async transfer(source, destination, options) {
    const auth = parseFtpDestination(destination);
    const client = new Client(undefined, 5000);
    client.ftp.verbose = false;

    try {
      await client.access({
        host: auth.host,
        port: auth.port,
        user: auth.user,
        password: auth.password,
        secure: false,
      });

      const info = await stat(source);
      const fileName = source.replace(/^.*[/\\]/, "");

      if (info.isDirectory() && options.recursive) {
        await client.uploadFromDir(source, auth.path);
      } else if (info.isFile()) {
        const remotePath = auth.path.endsWith("/") ? `${auth.path}${fileName}` : auth.path;
        await client.uploadFrom(source, remotePath);
      } else {
        throw new Error("Source is a directory; use --recursive.");
      }
    } finally {
      client.close();
    }
  },
};
