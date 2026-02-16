/**
 * Simple UDP file transfer — chunks sent over UDP with sequence numbers.
 * Best for: local LAN, speed over reliability, or when TCP is throttled.
 * No encryption; use only on trusted networks.
 */

import type { ProtocolAdapter } from "../types.js";
import { createSocket } from "dgram";
import { createReadStream, createWriteStream } from "fs";
import { stat, mkdir } from "fs/promises";
import { dirname } from "path";
import { createInterface } from "readline";

const CHUNK_SIZE = 64 * 1024; // 64KB
const MAGIC = 0x584652; // "XFR"
const HEADER_SIZE = 4 + 4 + 4; // magic, seq, total

function parseUdpDestination(dest: string): { host: string; port: number; path?: string } {
  // host:port or host:port:path
  const parts = dest.split(":");
  if (parts.length < 2) throw new Error(`Invalid UDP destination: ${dest}. Use host:port or host:port:path`);
  const host = parts[0];
  const port = parseInt(parts[1], 10);
  const path = parts[2];
  if (!host || isNaN(port)) throw new Error(`Invalid UDP destination: ${dest}`);
  return { host, port, path };
}

export const udpAdapter: ProtocolAdapter = {
  name: "udp",
  description: "UDP — fast, best for LAN; no encryption, may lose packets",

  async available(): Promise<boolean> {
    return true; // Node/Bun built-in
  },

  async transfer(source, destination, options) {
    const { host, port, path } = parseUdpDestination(destination);
    const info = await stat(source);
    if (info.isDirectory()) {
      throw new Error("UDP adapter supports single-file only. Use a tarball or pick another protocol.");
    }

    const fileSize = info.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    const socket = createSocket("udp4");
    const buf = Buffer.alloc(HEADER_SIZE + CHUNK_SIZE);

    return new Promise<void>((resolve, reject) => {
      let sent = 0;

      const sendChunk = (seq: number, data: Buffer) => {
        buf.writeUInt32BE(MAGIC, 0);
        buf.writeUInt32BE(seq, 4);
        buf.writeUInt32BE(totalChunks, 8);
        data.copy(buf, HEADER_SIZE);
        socket.send(buf, 0, HEADER_SIZE + data.length, port, host, (err) => {
          if (err) reject(err);
          else if (seq === totalChunks - 1) {
            socket.close();
            resolve();
          }
        });
      };

      const stream = createReadStream(source, { highWaterMark: CHUNK_SIZE });
      let seq = 0;
      stream.on("data", (chunk: Buffer) => {
        sendChunk(seq++, chunk);
        sent++;
        if (options.progress && sent % 100 === 0) {
          process.stderr.write(`\rUDP sent ${sent}/${totalChunks} chunks`);
        }
      });
      stream.on("error", (err) => {
        socket.close();
        reject(err);
      });
    });
  },
};

/**
 * Receive a file sent by the UDP adapter (for testing / receiver mode).
 * Usage: start receiver first on host:port, then sender.
 */
export async function receiveUdpFile(host: string, port: number, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const out = createWriteStream(outputPath);
  const socket = createSocket("udp4");
  const chunks: Map<number, Buffer> = new Map();
  let totalChunks = 0;

  return new Promise((resolve, reject) => {
    socket.on("message", (msg) => {
      const magic = msg.readUInt32BE(0);
      if (magic !== MAGIC) return;
      const seq = msg.readUInt32BE(4);
      const total = msg.readUInt32BE(8);
      totalChunks = total;
      const data = msg.subarray(HEADER_SIZE);
      chunks.set(seq, Buffer.from(data));
      if (chunks.size === total) {
        for (let i = 0; i < total; i++) out.write(chunks.get(i));
        out.end();
        socket.close();
        resolve();
      }
    });
    socket.bind(port, host);
  });
}
