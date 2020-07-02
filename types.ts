interface StreamReader {
  get(id: string): Promise<Post>;
  before(): Promise<Post | undefined>;
  before(date?: Date): Promise<Post | undefined>;
}

interface Post {
  date: Date;
  contentType: string;
  body: Deno.Reader & Deno.Closer;
}
