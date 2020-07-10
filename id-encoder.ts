import { encode as enc, decode as dec } from "https://deno.land/std/encoding/base64url.ts";

// if you want opaque ids

export function encode(str:string):string {
  return enc(new TextEncoder().encode(str))
}

export function decode(str:string):string {
  return new TextDecoder().decode(dec(str))
}