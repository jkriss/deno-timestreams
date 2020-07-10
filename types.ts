export interface StreamReader {
  get(id: string): Promise<Post | undefined>;
  previous(id: string): Promise<Post | undefined>;
  previousId(id: string): Promise<string | undefined>;
  before(): Promise<Post | undefined>;
  before(date?: Date): Promise<Post | undefined>;
}

export interface Post {
  id: string;
  date: Date;
  contentType: string;
  links?: Link[];
  headers?: Headers;
  getReader(): Promise<Deno.Reader & Deno.Closer>;
  version: string;
}

export interface Link {
  rel: string;
  url: string;
  type?: string
}

export interface SimpleHeaders {
  [k: string]: string;
}

export type PostHeaderName = "date" | "contentType";
