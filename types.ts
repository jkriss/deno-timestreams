interface StreamReader {
  get(id: string): Promise<Post | undefined>;
  before(): Promise<Post | undefined>;
  before(date?: Date): Promise<Post | undefined>;
}

interface Post {
  id: string;
  date: Date;
  contentType: string;
  getReader(): Promise<Deno.Reader & Deno.Closer>;
}
