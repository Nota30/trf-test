# file-transfer-cli (xfer)

A **Bun** command-line tool that unifies multiple file transfer protocols (SCP, SFTP, FTP, RSYNC, UDP, QUIC, UDR) behind one interface. You can either **pick a protocol** or let the tool **auto-select** the best one based on the file and destination.

## Install

Install [Bun](https://bun.sh) if needed, then:

```bash
cd file-transfer-cli
bun install
```

## Usage

```bash
# Auto-select protocol from file + destination
bun run src/cli.ts ./myfile.txt user@server:/home/user/

# Interactive protocol picker
bun run src/cli.ts --pick ./backup.zip user@host:/data/

# Force a protocol
bun run src/cli.ts --protocol=rsync -r ./dist server:/var/www

# Recursive + progress
bun run src/cli.ts -r --progress ./folder user@host:/path/
```

### Options

| Option | Description |
|--------|-------------|
| `-r`, `--recursive` | Transfer directories recursively |
| `--progress` | Show progress where supported |
| `-p`, `--pick` | Show interactive protocol picker |
| `--protocol=<name>` | Force protocol: `scp`, `sftp`, `ftp`, `rsync`, `udp`, `quic`, `udr` |
| `-h`, `--help` | Show help |

## Protocols

| Protocol | Description | Requirements |
|----------|-------------|--------------|
| **SCP** | Secure Copy over SSH | `ssh2` (included), SSH key or password |
| **SFTP** | SSH File Transfer Protocol | `ssh2` (included) |
| **FTP** | Classic FTP | `basic-ftp` (included) |
| **RSYNC** | Delta sync, great for dirs | `rsync` binary in PATH |
| **UDP** | Simple UDP (single file) | None (built-in) — use `host:port` as destination |
| **QUIC** | HTTP/3 upload | `curl` with HTTP/3, server support |
| **UDR** | UDT + rsync (fast WAN) | `udr` binary in PATH |

## Auto-selection rules

- **FTP URL** (`ftp://...`) → FTP  
- **HTTPS URL** → QUIC (if available)  
- **Directory** → RSYNC  
- **Very large file (≥1 GB)** → UDR if available, else RSYNC  
- **Large file (≥100 MB)** → RSYNC  
- **Other remote** → SFTP (secure default)

## Environment

- `SSH_PRIVATE_KEY_PATH` — Path to SSH private key for SCP/SFTP  
- `FTP_PASSWORD` — FTP password when using `user@host:path` (no URL)

## Examples

```bash
# SSH-style destination (SCP/SFTP/RSYNC)
xfer ./app.tar.gz user@example.com:/tmp/
xfer -r ./build/ deploy@server:/var/www/

# FTP
xfer ./file.txt ftp://user:pass@ftp.example.com/upload/

# UDP (receiver must be listening; single file only)
xfer ./big.bin 192.168.1.10:9999

# QUIC (HTTP/3 server)
xfer ./data.zip https://upload.example.com/upload
```

## Programmatic API

```ts
import { transfer, getAvailableProtocols } from "file-transfer-cli";

await transfer({
  source: "./dist",
  destination: "user@server:/var/www",
  recursive: true,
  progress: true,
  // protocol: "sftp",  // optional
  // pick: true,         // interactive
});
```

## License

MIT
