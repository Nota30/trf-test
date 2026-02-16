/**
 * Programmatic API for unified file transfer.
 */

export { protocols, getAvailableProtocols, protocolList } from "./protocols/index.js";
export type { Protocol, TransferOptions, ProtocolAdapter, FileInfo } from "./types.js";
export { resolveProtocol, suggestProtocol, getFileInfo } from "./selector.js";

import { protocols } from "./protocols/index.js";
import { resolveProtocol } from "./selector.js";
import type { TransferOptions, Protocol } from "./types.js";

/**
 * Transfer files using the best available protocol or the one specified.
 */
export async function transfer(options: TransferOptions): Promise<void> {
  const protocol = await resolveProtocol(options.source, options.destination, {
    protocol: options.protocol,
    pick: options.pick,
  });
  const adapter = protocols[protocol];
  if (!(await adapter.available())) {
    throw new Error(`Protocol "${protocol}" is not available.`);
  }
  await adapter.transfer(options.source, options.destination, {
    recursive: options.recursive,
    progress: options.progress,
  });
}
