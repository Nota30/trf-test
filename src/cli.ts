#!/usr/bin/env bun
/**
 * Unified file transfer CLI — SCP, SFTP, FTP, RSYNC, UDP, QUIC, UDR.
 * Usage:
 *   xfer <source> <destination> [options]
 *   xfer --pick <source> <destination>   # interactive protocol pick
 *   xfer --protocol=rsync <source> <dest>
 */

import { protocols } from "./protocols/index.js";
import { resolveProtocol } from "./selector.js";
import type { Protocol } from "./types.js";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let source: string | null = null;
  let destination: string | null = null;
  let protocol: Protocol | undefined;
  let pick = false;
  let recursive = false;
  let progress = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") help = true;
    else if (a === "--pick" || a === "-p") pick = true;
    else if (a === "--recursive" || a === "-r") recursive = true;
    else if (a === "--progress") progress = true;
    else if (a.startsWith("--protocol=")) protocol = a.slice("--protocol=".length) as Protocol;
    else if (a === "--protocol" && args[i + 1]) protocol = args[++i] as Protocol;
    else if (source === null) source = a;
    else if (destination === null) destination = a;
  }

  return { source, destination, protocol, pick, recursive, progress, help };
}

function printHelp() {
  console.log(`
file-transfer-cli (xfer) — unified file transfer

  Usage:
    xfer <source> <destination> [options]
    xfer --pick <source> <destination>     Pick protocol interactively
    xfer --protocol=<name> <source> <dest> Use specific protocol

  Protocols:
    scp   — Secure Copy over SSH
    sftp  — SSH File Transfer Protocol
    ftp   — FTP (plain)
    rsync — RSYNC (requires rsync binary)
    udp   — Simple UDP (single file, host:port)
    quic  — QUIC/HTTP3 (requires curl with HTTP3, server support)
    udr   — UDR/UDT (requires udr binary, fast WAN)

  Options:
    -r, --recursive   Transfer directories recursively
    --progress        Show progress
    -p, --pick        Show protocol picker instead of auto
    --protocol=NAME   Force protocol
    -h, --help        This help

  Examples:
    xfer ./file.txt user@server:/home/user/
    xfer -r ./dist server:/var/www
    xfer --protocol=rsync ./backup user@host:/backup
    xfer --pick ./large.zip user@host:/data/

  Environment:
    SSH_PRIVATE_KEY_PATH  Optional path to SSH private key
    FTP_PASSWORD         FTP password when using user@host:path
`);
}

async function main() {
  const { source, destination, protocol, pick, recursive, progress, help } = parseArgs(process.argv);

  if (help || !source || !destination) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  const resolved = await resolveProtocol(source, destination, { protocol, pick });
  const adapter = protocols[resolved];

  if (!(await adapter.available())) {
    console.error(`Protocol "${resolved}" is not available (missing binary or dependency).`);
    process.exit(1);
  }

  console.error(`Using protocol: ${resolved}`);
  await adapter.transfer(source, destination, { recursive, progress });
  console.error("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
