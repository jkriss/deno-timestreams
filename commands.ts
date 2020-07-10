import * as http from "https://deno.land/std/http/server.ts";
import { FileStreamReader } from "./reader.ts";
import { StreamReader, Post } from "./types.ts";
import {
  HttpHeaders,
  JsonHeaders,
  GeminiHeaders,
  getHTTPHeader,
} from "./headers.ts";
import { HTTPStreamReader } from "./http/stream-reader.ts";
import { encode, decode } from './id-encoder.ts'

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
  outputStream?: Deno.Writer & Deno.Closer;
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
  const port = 8000;
  const server = http.serve({ port });
  console.log(`listening at http://localhost:${port}, opts`, opts);
  for await (const req of server) {
    const start = performance.now();
    const stream = getStream(opts);

    const url = new URL(req.url, "http://localhost");
    const searchParams = new URLSearchParams(url.search.slice(1));
    const beforeDateStr = searchParams.get("before");
    const before = beforeDateStr ? new Date(beforeDateStr) : undefined;

    let postId: string | undefined;
    const parts = url.pathname.split("/");
    postId = parts[parts.length - 1];

    const post: Post | undefined = postId
      ? await stream.get(decode(postId))
      : await stream.before(before);
    if (post) {
      if (post.links) {
        // only returning the absolute url paths,
        // so this part won't make it back to the client
        for (const link of post.links) {
          // console.log("handling link", link, "adding prefix", url.pathname);
          // if (!link.url.startsWith("http") && !link.url.startsWith("/")) {
          //   link.url = `${url.pathname}${link.url}`;
          // }
          // if it's a plain id, encode it
          if (!link.url.includes('/')) {
            link.url = encode(link.url)
          }
        }
      }
      const headers = post.headers || new Headers();
      function set(k: string, v: any) {
        const val = getHTTPHeader(k, v);
        if (val) headers.set(k, val);
      }
      set("content-type", post.contentType);
      set("post-time", post.date);
      set("time-streams-version", post.version);
      set("link", post.links);
      const body = await post.getReader();
      req.respond({ body, headers });
    } else {
      req.respond({ status: 404 });
    }
    console.log(`-- handled request in ${performance.now() - start}ms --`);
  }
}

export async function get(opts?: GetOptions) {
  if (!opts) opts = {};

  const proxyHeaders = ["content-length", "last-modified", "etag"];

  const stream = getStream(opts);
  const output = opts.outputStream || Deno.stdout;
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
      await h.setHeader("link", post.links);
      await h.setHeader("post-time", post.date);
      await h.setHeader("content-type", post.contentType);
      await h.setHeader("time-streams-version", post.version);
      if (post.headers) {
        for (const [k, v] of post.headers.entries()) {
          if (proxyHeaders.includes(k)) await h.setHeader(k, v);
        }
      }
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
