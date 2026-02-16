/**
 * SCP (Secure Copy) over SSH - uses ssh2 to exec scp or emulate via SFTP.
 */

import { Client } from "ssh2";
import type { ProtocolAdapter } from "../types.js";
import { readFile, stat } from "fs/promises";
import { createReadStream } from "fs";
import { parseScpDestination } from "../parse-destination.js";

function parseAuth(dest: string): { host: string; port: number; user: string; path: string } {
  const parsed = parseScpDestination(dest);
  if (!parsed) throw new Error(`Invalid SCP destination: ${dest}`);
  return {
    host: parsed.host,
    port: parsed.port ?? 22,
    user: parsed.user ?? "anonymous",
    path: parsed.path,
  };
}

export const scpAdapter: ProtocolAdapter = {
  name: "scp",
  description: "Secure Copy over SSH — good for single files, encrypted",

  async available(): Promise<boolean> {
    try {
      const mod = await import("ssh2");
      return !!mod.Client;
    } catch {
      return false;
    }
  },

  async transfer(source, destination, options) {
    const auth = parseAuth(destination);
    const conn = new Client();
    const privateKey = process.env.SSH_PRIVATE_KEY_PATH
      ? await readFile(process.env.SSH_PRIVATE_KEY_PATH).catch(() => undefined)
      : undefined;

    await new Promise<void>((resolve, reject) => {
      conn
        .on("ready", () => resolve())
        .on("error", reject)
        .connect({
          host: auth.host,
          port: auth.port,
          username: auth.user,
          tryKeyboard: true,
          privateKey: privateKey ?? undefined,
        });
    });

    try {
      const info = await stat(source);
      if (info.isDirectory() && options.recursive) {
        // Use SFTP for directory (SCP dir is complex); same connection
        const sftp = await new Promise<import("ssh2").SFTPWrapper>((res, rej) => {
          conn.sftp((err, sftp) => (err ? rej(err) : res(sftp!)));
        });
        await uploadDirOverSftp(conn, sftp, source, auth.path);
      } else if (info.isFile()) {
        const sftp = await new Promise<import("ssh2").SFTPWrapper>((res, rej) => {
          conn.sftp((err, sftp) => (err ? rej(err) : res(sftp!)));
        });
        const remotePath = auth.path.endsWith("/") ? `${auth.path}${source.split(/[/\\]/).pop()}` : auth.path;
        await new Promise<void>((res, rej) => {
          const stream = createReadStream(source);
          sftp.fastPut(stream, remotePath, (err) => (err ? rej(err) : res()));
        });
      } else {
        throw new Error("Source is a directory; use --recursive for directories.");
      }
    } finally {
      conn.end();
    }
  },
};

async function uploadDirOverSftp(
  conn: Client,
  sftp: import("ssh2").SFTPWrapper,
  localDir: string,
  remoteBase: string
): Promise<void> {
  const { readdir, stat: statLocal } = await import("fs/promises");
  const { join } = await import("path");
  const { createReadStream } = await import("fs");

  const ensureDir = (path: string) =>
    new Promise<void>((res, rej) => {
      sftp.mkdir(path, (err) => {
        if (err && err.message?.includes("failure")) rej(err);
        else res();
      });
    });

  const entries = await readdir(localDir, { withFileTypes: true });
  for (const e of entries) {
    const localPath = join(localDir, e.name);
    const remotePath = `${remoteBase.replace(/\/$/, "")}/${e.name}`;
    if (e.isDirectory()) {
      await ensureDir(remotePath);
      await uploadDirOverSftp(conn, sftp, localPath, remotePath);
    } else {
      await new Promise<void>((res, rej) => {
        sftp.fastPut(createReadStream(localPath), remotePath, (err) => (err ? rej(err) : res()));
      });
    }
  }
}
