/**
 * Serves the built site over real sockets, with real cache headers, and fails
 * chunks to order. `page.route` turns the browser's HTTP cache off, which hid
 * WebKit's failure modes from every spec that uses it, so specs on this server
 * use no route at all, including the font route in `helpers.ts`.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../../../dist", import.meta.url));
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
};

export type RequestFate = "serve" | "drop" | "not-found";

export interface RealServer {
  readonly url: string;
  /** Decides each request from here on, by its path. */
  setFate(fate: (path: string) => RequestFate): void;
  requestsFor(pathPattern: RegExp): number;
  close(): void;
}

export async function startRealServer(): Promise<RealServer> {
  let fateOf: (path: string) => RequestFate = () => "serve";
  const requested: string[] = [];

  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    requested.push(path);
    const fate = fateOf(path);
    if (fate === "drop") {
      request.socket.destroy();
      return;
    }
    const file = join(DIST, path.endsWith("/") ? `${path}index.html` : path);
    const extension = extname(file);
    const body = await readFile(file).catch(() => null);
    if (fate === "not-found" || !body) {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "cache-control": extension === ".html" ? "no-cache" : "max-age=600",
    });
    response.end(extension === ".js" ? withEvaluationCount(path, body) : body);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The server has no port.");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    setFate(fate) {
      fateOf = fate;
    },
    requestsFor: (pattern) =>
      requested.filter((path) => pattern.test(path)).length,
    close() {
      server.closeAllConnections();
      server.close();
    },
  };
}

/** Each chunk counts its own evaluations, so a second world would show. */
function withEvaluationCount(path: string, body: Buffer): string {
  const key = JSON.stringify(path.split("/").pop());
  return `${body};(globalThis.__chunkEvaluations??={}),globalThis.__chunkEvaluations[${key}]=(globalThis.__chunkEvaluations[${key}]??0)+1;`;
}
