/**
 * Registry of all protocol adapters.
 */

import type { Protocol, ProtocolAdapter } from "../types.js";
import { scpAdapter } from "./scp.js";
import { sftpAdapter } from "./sftp.js";
import { ftpAdapter } from "./ftp.js";
import { rsyncAdapter } from "./rsync.js";
import { udpAdapter } from "./udp.js";
import { quicAdapter } from "./quic.js";
import { udrAdapter } from "./udr.js";

export const protocols: Record<Protocol, ProtocolAdapter> = {
  scp: scpAdapter,
  sftp: sftpAdapter,
  ftp: ftpAdapter,
  rsync: rsyncAdapter,
  udp: udpAdapter,
  quic: quicAdapter,
  udr: udrAdapter,
};

export const protocolList: Protocol[] = [
  "scp",
  "sftp",
  "ftp",
  "rsync",
  "udp",
  "quic",
  "udr",
];

export async function getAvailableProtocols(): Promise<ProtocolAdapter[]> {
  const results = await Promise.all(
    protocolList.map(async (p) => ({ protocol: protocols[p], available: await protocols[p].available() }))
  );
  return results.filter((r) => r.available).map((r) => r.protocol);
}
