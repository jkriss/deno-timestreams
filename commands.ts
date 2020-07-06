import { FileStreamReader } from "./reader.ts";
import { StreamReader } from "./types.ts";
import { HttpHeaders, JsonHeaders } from "./headers.ts";

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
    // TODO create other types for other url types
    return new FileStreamReader({ path: url.href });
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
  // console.log("getting with opts", opts)
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
      } else {
        throw new Error(`Format ${opts.format} not recognized`);
      }
      // TODO implement previous post lookup
      await h.setHeader("post-time", post.date.toUTCString());
      await h.setHeader("content-type", post.contentType);
      await h.closeHeaders();
    }
    if (!opts.headersOnly) {
      const body = await post.getReader();
      const bytes = await Deno.readAll(body);
      body.close();
      Deno.stdout.write(bytes);  
    }
  } else {
    throw new Error(`Not found`);
  }
}
