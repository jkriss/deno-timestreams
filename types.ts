export interface StreamReader {
  get(id: string): Promise<Post | undefined>;
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
}

export interface SimpleHeaders {
  [k: string]: string;
}

export type PostHeaderName = "date" | "contentType";
