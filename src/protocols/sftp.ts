/**
 * SFTP (SSH File Transfer Protocol) via ssh2.
 */

import { Client } from "ssh2";
import type { ProtocolAdapter } from "../types.js";
import { readFile } from "fs/promises";
import { createReadStream } from "fs";
import { parseScpDestination } from "../parse-destination.js";

function parseAuth(dest: string): { host: string; port: number; user: string; path: string } {
  const parsed = parseScpDestination(dest);
  if (!parsed) throw new Error(`Invalid SFTP destination: ${dest}`);
  return {
    host: parsed.host,
    port: parsed.port ?? 22,
    user: parsed.user ?? "anonymous",
    path: parsed.path,
  };
}

export const sftpAdapter: ProtocolAdapter = {
  name: "sftp",
  description: "SSH File Transfer Protocol — reliable, encrypted, good for directories",

  async available(): Promise<boolean> {
    try {
      await import("ssh2");
      return true;
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
      const sftp = await new Promise<import("ssh2").SFTPWrapper>((res, rej) => {
        conn.sftp((err, sftp) => (err ? rej(err) : res(sftp!)));
      });

      const { stat } = await import("fs/promises");
      const info = await stat(source);
      if (info.isDirectory() && options.recursive) {
        await uploadDir(sftp, source, auth.path);
      } else if (info.isFile()) {
        const remotePath = auth.path.endsWith("/")
          ? `${auth.path}${source.replace(/^.*[/\\]/, "")}`
          : auth.path;
        await new Promise<void>((res, rej) => {
          sftp.fastPut(createReadStream(source), remotePath, (err) => (err ? rej(err) : res()));
        });
      } else {
        throw new Error("Source is a directory; use --recursive.");
      }
    } finally {
      conn.end();
    }
  },
};

async function uploadDir(
  sftp: import("ssh2").SFTPWrapper,
  localDir: string,
  remoteBase: string
): Promise<void> {
  const { readdir } = await import("fs/promises");
  const { join } = await import("path");
  const { createReadStream } = await import("fs");

  const ensureDir = (path: string) =>
    new Promise<void>((res, rej) => {
      sftp.mkdir(path, (err) => {
        if (err && !String(err.message).includes("failure")) res();
        else res();
      });
    });

  const entries = await readdir(localDir, { withFileTypes: true });
  for (const e of entries) {
    const localPath = join(localDir, e.name);
    const remotePath = `${remoteBase.replace(/\/$/, "")}/${e.name}`;
    if (e.isDirectory()) {
      await ensureDir(remotePath);
      await uploadDir(sftp, localPath, remotePath);
    } else {
      await new Promise<void>((res, rej) => {
        sftp.fastPut(createReadStream(localPath), remotePath, (err) => (err ? rej(err) : res()));
      });
    }
  }
}
