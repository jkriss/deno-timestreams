import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { FileStreamReader } from "./reader.ts";

const r = new FileStreamReader("posts");

Deno.test("get latest post without a date", async () => {
  const post: Post = await r.before();
  if (!post) throw Error(`should get a post`);
  const body = await post.getReader();
  if (!body) throw Error(`post should have a body`);
  const bytes = await Deno.readAll(body);
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text !== "with a timestamp") {
    throw Error(
      `post body should be "with a timestamp", not ${JSON.stringify(text)}`,
    );
  }
  body.close();
});

Deno.test("get latest post before a time", async () => {
  const post: Post = await r.before(new Date("2020-07-01T05:11:21Z"));
  if (!post) throw Error(`should get a post`);
  const body = await post.getReader();
  if (!body) throw Error(`post should have a body`);
  const bytes = await Deno.readAll(body);
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text !== "hi there!") {
    throw Error(`post body should be "hi there!", not ${JSON.stringify(text)}`);
  }
  body.close();
});

Deno.test("return null for years before the stream", async () => {
  const post = await r.before(new Date("1980-01-01"));
  if (post) throw Error(`shouldn't get a post`);
});

Deno.test("return null for years after the stream", async () => {
  const post = await r.before(new Date("20980-01-01"));
  if (post) throw Error(`shouldn't get a post`);
});

Deno.test("get post by id", async () => {
  const post: Post = await r.before();
  assert(post, "should get a post");
  assert(post.id, "post should have an id");
  const samePost = await r.get(post.id);
  assert(samePost, "retreived post should exist");
  assertEquals(
    post.id,
    samePost.id,
    `ids should match: ${post.id} ${samePost.id}`,
  );
});

Deno.test("get prefix-less post by id", async () => {
  const post = await r.get("20200701000000Z-hello");
  assert(post, "should get a post");
});
