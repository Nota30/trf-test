/**
 * Common types for the unified file transfer CLI.
 */

export type Protocol =
  | "scp"
  | "sftp"
  | "ftp"
  | "rsync"
  | "udp"
  | "quic"
  | "udr";

export interface TransferOptions {
  /** Local path (file or directory) */
  source: string;
  /** Remote destination (host:path or path) */
  destination: string;
  /** Override protocol (if not auto) */
  protocol?: Protocol;
  /** Force protocol selection (skip auto) */
  pick?: boolean;
  /** Recursive (directories) */
  recursive?: boolean;
  /** Show progress */
  progress?: boolean;
}

export interface ProtocolAdapter {
  name: Protocol;
  description: string;
  /** Whether this protocol is available (e.g. rsync/udr binary installed) */
  available(): Promise<boolean>;
  /** Transfer source -> destination */
  transfer(
    source: string,
    destination: string,
    options: { recursive?: boolean; progress?: boolean }
  ): Promise<void>;
}

export interface FileInfo {
  path: string;
  size: number;
  isDirectory: boolean;
  /** Best protocol suggestion based on size/latency heuristics */
  suggestedProtocol?: Protocol;
}
