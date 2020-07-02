import { FileStreamReader } from "./reader.ts";

const r = new FileStreamReader("posts");

Deno.test("get latest post without a date", async () => {
  const post: Post = await r.before();
  if (!post) throw Error(`should get a post`);
  if (!post.body) throw Error(`post should have a body`);
  const bytes = await Deno.readAll(post.body);
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text !== "with a timestamp") {
    throw Error(
      `post body should be "with a timestamp", not ${JSON.stringify(text)}`,
    );
  }
  post.body.close();
});

Deno.test("get latest post before a time", async () => {
  const post: Post = await r.before(new Date("2020-07-01T05:11:21Z"));
  if (!post) throw Error(`should get a post`);
  if (!post.body) throw Error(`post should have a body`);
  const bytes = await Deno.readAll(post.body);
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text !== "hi there!") {
    throw Error(`post body should be "hi there!", not ${JSON.stringify(text)}`);
  }
  post.body.close();
});

Deno.test("return null for years before the stream", async () => {
  const post = await r.before(new Date("1980-01-01"));
  if (post) throw Error(`shouldn't get a post`);
});

Deno.test("return null for years after the stream", async () => {
  const post = await r.before(new Date("20980-01-01"));
  if (post) throw Error(`shouldn't get a post`);
});
