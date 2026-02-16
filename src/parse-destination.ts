/**
 * Parse user@host:path or host:path for SCP/SFTP/RSYNC-style destinations.
 */

export interface ParsedDestination {
  user?: string;
  host: string;
  port?: number;
  path: string;
}

/**
 * Parse "user@host:path" or "host:path". IPv6 [host]:port not fully supported.
 */
export function parseScpDestination(dest: string): ParsedDestination | null {
  const trim = dest.trim();
  if (!trim) return null;

  let user: string | undefined;
  let rest = trim;

  const at = rest.indexOf("@");
  if (at > 0) {
    user = rest.slice(0, at);
    rest = rest.slice(at + 1);
  }

  // host can be [ipv6]:port or hostname
  const bracket = rest.indexOf("[");
  let host: string;
  let port: number | undefined;
  let path: string;

  if (bracket === 0) {
    const close = rest.indexOf("]");
    if (close === -1) return null;
    host = rest.slice(1, close);
    rest = rest.slice(close + 1);
    if (rest[0] === ":") {
      const portPath = rest.slice(1);
      const colon = portPath.indexOf(":");
      if (colon === -1) {
        path = portPath;
      } else {
        port = parseInt(portPath.slice(0, colon), 10);
        path = portPath.slice(colon + 1);
      }
    } else {
      path = rest;
    }
  } else {
    const firstColon = rest.indexOf(":");
    if (firstColon === -1) return null;
    host = rest.slice(0, firstColon);
    path = rest.slice(firstColon + 1);
    // Optional :port in path is not parsed here (path can contain colons on Windows)
  }

  if (!host || path === undefined) return null;
  return { user, host, port, path };
}
