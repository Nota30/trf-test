/**
 * Protocol selection: auto (by file/destination) or interactive picker.
 */

import type { Protocol, FileInfo } from "./types.js";
import { getAvailableProtocols } from "./protocols/index.js";
import { stat } from "fs/promises";
import prompts from "prompts";

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100 MB
const HUGE_FILE_THRESHOLD = 1024 * 1024 * 1024; // 1 GB

export async function getFileInfo(source: string): Promise<FileInfo | null> {
  try {
    const info = await stat(source);
    return {
      path: source,
      size: info.size,
      isDirectory: info.isDirectory(),
    };
  } catch {
    return null;
  }
}

/**
 * Suggest best protocol from file info and destination string.
 */
export function suggestProtocol(fileInfo: FileInfo | null, destination: string): Protocol {
  const dest = destination.toLowerCase();
  const isRemote = /^[a-z0-9.-]+:/.test(destination) || dest.startsWith("ftp://") || dest.startsWith("https://");

  if (!isRemote) return "rsync"; // local-to-local

  // Destination hints
  if (dest.startsWith("ftp://")) return "ftp";
  if (dest.startsWith("https://") || dest.startsWith("http3")) return "quic";

  const size = fileInfo?.size ?? 0;

  // Large files over WAN: UDR or RSYNC
  if (fileInfo?.isDirectory) return "rsync";
  if (size >= HUGE_FILE_THRESHOLD) return "udr";
  if (size >= LARGE_FILE_THRESHOLD) return "rsync";

  // Default secure choice for remote
  return "sftp";
}

/**
 * Resolve protocol: explicit, auto-suggest, or interactive pick.
 */
export async function resolveProtocol(
  source: string,
  destination: string,
  options: { protocol?: Protocol; pick?: boolean }
): Promise<Protocol> {
  if (options.protocol) return options.protocol;

  const fileInfo = await getFileInfo(source);
  const suggested = suggestProtocol(fileInfo, destination);
  const available = await getAvailableProtocols();

  const suggestedAdapter = available.find((a) => a.name === suggested);
  if (!options.pick && suggestedAdapter) return suggested;

  // Interactive pick
  const { protocol } = await prompts({
    type: "select",
    name: "protocol",
    message: "Choose transfer protocol",
    choices: available.map((a) => ({
      title: `${a.name} — ${a.description}`,
      value: a.name,
    })),
    initial: available.findIndex((a) => a.name === suggested),
  });

  if (!protocol) throw new Error("No protocol selected.");
  return protocol as Protocol;
}
