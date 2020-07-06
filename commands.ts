import { FileStreamReader } from "./reader.ts";
import { StreamReader } from "./types.ts";
import { HttpHeaders, JsonHeaders, GeminiHeaders } from "./headers.ts";
import { HTTPStreamReader } from "./http/stream-reader.ts";

interface StreamOptions {
  url?: string;
  protocol?: "http";
}

interface GetOptions extends StreamOptions {
  before?: Date;
  id?: string;
  headers?: boolean;
  headersOnly?: boolean;
  format?: "http" | "json";
}

function getStream(opts?: StreamOptions): StreamReader {
  if (!opts) opts = {};
  if (!opts.url) opts.url = ".";

  // if it's a relative url, it's a local file, so use that as the base
  const url = new URL(opts.url, `file://${Deno.cwd()}/`);

  if (url.protocol === "file:") {
    return new FileStreamReader({ path: url.href });
  } else if (url.protocol.startsWith("http")) {
    return new HTTPStreamReader(url.href);
  } else {
    throw new Error(`Protocol ${url.protocol} not supported`);
  }
}

export async function serve(opts?: StreamOptions) {
  const stream = getStream(opts);
  const first = await stream.before();
  console.log("first post:", first);
}

export async function get(opts?: GetOptions) {
  if (!opts) opts = {};

  const stream = getStream(opts);
  const output = Deno.stdout;
  const post = await stream.before();
  if (post) {
    if (opts?.headers) {
      let h;
      if (opts.format === "json") {
        h = new JsonHeaders(output);
      } else if (!opts.format || opts.format === "http") {
        h = new HttpHeaders(output);
      } else if (opts.format === "gemini") {
        h = new GeminiHeaders(output);
      } else {
        throw new Error(`Format ${opts.format} not recognized`);
      }
      // TODO implement previous post lookup
      await h.setHeader("link", post.links);
      await h.setHeader("post-time", post.date);
      await h.setHeader("content-type", post.contentType);
      await h.setHeader("time-streams-version", post.version);
      await h.closeHeaders();
    }
    if (!opts.headersOnly) {
      const body = await post.getReader();
      await Deno.copy(body, Deno.stdout);
      await body.close();
    }
  } else {
    throw new Error(`Not found`);
  }
}
