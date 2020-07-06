import { fromStreamReader } from "https://deno.land/std/io/mod.ts";
import { StreamReader, Post } from "../types.ts";
import { parseLinkHeader } from "../link-header.ts";

export class HTTPStreamReader implements StreamReader {
  private url: URL;
  constructor(url: string) {
    this.url = new URL(url);
  }
  async get(id: string): Promise<Post | undefined> {
    return this.getUrl(new URL(`${this.url.href}/${id}`));
  }
  async before(date?: Date): Promise<Post | undefined> {
    let url = this.url.href;
    if (date) url += `?before=${date.toISOString()}`;
    return this.getUrl(new URL(url));
  }

  private async getUrl(url: URL): Promise<Post | undefined> {
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
    const version = res.headers.get("time-streams-version");
    if (!version)
      throw new Error(`Post didn't have a Time-Streams-Version header`);
    const link = parseLinkHeader(res.headers.get("link") || undefined);
    const self = link && link.find((entry) => entry.rel === "self");
    const pathParts = self && new URL(self.url, url).pathname.split("/");
    const id = pathParts && pathParts[pathParts.length - 1];
    if (!id) throw new Error(`Couldn't get post id from Link header`);
    const post: Post = {
      id,
      date: new Date(postTime),
      contentType,
      version,
      links: link,
      getReader: async () => {
        if (!res.body) throw new Error(`Post doesn't have a response body`);
        // adapt the body reader
        const resReader = res.body.getReader();
        const r = fromStreamReader(resReader);
        const close = () => resReader.cancel();
        return {
          read: r.read,
          close,
        };
      },
    };
    return post;
  }
}
