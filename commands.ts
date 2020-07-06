import { copyBytes } from "https://deno.land/std/bytes/mod.ts";
import { FileStreamReader } from "./reader.ts";
import { StreamReader, Post } from "./types.ts";
import { HttpHeaders, JsonHeaders } from "./headers.ts";
import { parseLinkHeader } from "./link-header.ts";

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

class HTTPStreamReader implements StreamReader {
  private url: URL;
  constructor(url: string) {
    this.url = new URL(url);
  }
  async get(id: string): Promise<Post | undefined> {
    return this.getUrl(new URL(`${this.url.href}/${id}`))
  }
  async before(date?: Date): Promise<Post | undefined> {
    let url = this.url.href;
    if (date) url += `?before=${date.toISOString()}`;
    return this.getUrl(new URL(url))
  }

  private async getUrl(url:URL): Promise<Post | undefined> {
    const res = await fetch(url.href);
    if (!res.ok) {
      if (res.status === 404) return undefined;
      const error = await res.text();
      throw new Error(`Error getting http post: ${error}`);
    }
    const postTime = res.headers.get("post-time");
    if (!postTime) throw new Error(`Post didn't have a Post-Time header`);
    const contentType = res.headers.get("content-type");
    if (!contentType) throw new Error(`Post didn't have a Content-Type header`);
    const link = parseLinkHeader(res.headers.get("link") || undefined);
    const self = link && link.find(entry => entry.rel === 'self')
    const pathParts = self && new URL(self.url, url).pathname.split('/')
    const id = pathParts && pathParts[pathParts.length-1]
    if (!id) throw new Error(`Couldn't get post id from Link header`)
    const post: Post = {
      id,
      date: new Date(postTime),
      contentType,
      links: link,
      getReader: async () => {
        if (!res.body) throw new Error(`Post doesn't have a response body`);
        // adapt the body reader
        const resReader = res.body.getReader();
        return {
          // TODO buffer if response chunk is larger than reader buffer
          async read(p: Uint8Array): Promise<number | null> {
            const chunk = await resReader.read();
            if (chunk.done) return null;
            if (chunk.value.length > p.length)
              throw new Error(
                `Response chunk of ${chunk.value.length} bytes is larger than read buffer of ${p.length} bytes`
              );
            copyBytes(chunk.value, p);
            return chunk.value.length;
          },
          close() {
            resReader.cancel();
          },
        };
      },
    };
    return post;
  }
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
      await h.setHeader('link', post.links)
      await h.setHeader("post-time", post.date);
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
