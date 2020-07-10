import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { FileStreamReader } from "./reader.ts";
import { StreamReader } from "./types.ts";

const r:StreamReader = new FileStreamReader({ path: "posts.timestream" });

Deno.test("get latest post without a date", async () => {
  const post = await r.before();
  if (!post) throw Error(`should get a post`);
  const body = await post.getReader();
  if (!body) throw Error(`post should have a body`);
  const bytes = await Deno.readAll(body);
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text !== "with a timestamp") {
    throw Error(
      `post body should be "with a timestamp", not ${JSON.stringify(text)}`
    );
  }
  body.close();
});

Deno.test("get latest post before a time", async () => {
  const post = await r.before(new Date("2020-07-01T05:11:21Z"));
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
  const post = await r.before();
  assert(post, "should get a post");
  assert(post.id, "post should have an id");
  const samePost = await r.get(post.id);
  assert(samePost, "retreived post should exist");
  assertEquals(
    post.id,
    samePost.id,
    `ids should match: ${post.id} ${samePost.id}`
  );
});

Deno.test("get prefix-less post by id", async () => {
  const post = await r.get("20200701000000Z-hello.txt");
  assert(post, "should get a post");
});

Deno.test("get previous post", async () => {
  const post = await r.before();
  assert(post, "should get a post");
  let prev = await r.previous(post.id);
  assert(prev, "previous post should exist");
  assert(prev.id !== post.id, "posts should have different ids");
  prev = await r.previous(prev.id);
  assert(prev, "another previous post should exist");
  assert(prev.id !== post.id, "posts should have different ids");
});

Deno.test("get related data for post", async () => {
  const post = await r.get("20200701000000Z-hello.txt")
  assert(post, "should get a post")
  const textMeta = post.links?.find(r => r.rel === 'describedby' && r.type === 'text/plain')
  const jsonMeta = post.links?.find(r => r.rel === 'describedby' && r.type === 'application/json')
  assert(textMeta, "text meta should exist")
  assert(jsonMeta, "text meta should exist")
  const m = await r.get(jsonMeta.url)
  assert(m, "actual entry should exist")
  if (m) {
    const reader = await m.getReader()
    const bytes = await Deno.readAll(reader)
    reader.close()
    const json = JSON.parse(new TextDecoder().decode(bytes))
    assertEquals(json.author.name, 'Jesse Kriss')
  }
})

Deno.test("don't show relations in the main feed", async() => {
  let post = await r.before()
  assert(post, "first post should exist")
  assert(!post.id.includes('$'), "No $ in date query ids")
  for (let i=0; i<3; i++) {
    if (post) {
      post = await r.previous(post.id)
      assert(post && !post.id.includes('$'), `No $ in previous post ids, got ${post?.id}`)
    } else {
      assert(false, "should have a post")
    }
  }
})

Deno.test("correct time on previous link lookup without a time component", async() => {
  const post = await r.get("20200701051121Z-at-a-time.txt")
  assert(post, "should get a post")
  const previous = post.links?.find(link => link.rel === 'previous')
  assert(previous, "should have a previous link")
  assertEquals(previous.url, "20200701000000Z-hello.txt")
})