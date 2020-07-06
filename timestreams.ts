// cli for timestream stuff
import * as Commands from "./commands.ts";

const help = `Usage:

timestreams serve <source url>
timestreams get [--format http | json | gemini] [--headers] [--headers-only] <url>
timestreams archive <url> [path]`;

import { parse } from "https://deno.land/std/flags/mod.ts";

const args = parse(Deno.args);

const [cmd] = args._;

if (!cmd) {
  console.log(help);
} else {
  try {
    if (cmd === "serve") {
      const url = args.source || args._[1];
      await Commands.serve({ url });
    } else if (cmd === "get") {
      const url = args.source || args._[1];
      args.url = url;
      if (args['headers-only']) args.headersOnly = args['headers-only']
      if (!args.headers && args.headersOnly) args.headers = true
      await Commands.get(Object.assign({}, args, { url }));
    } else {
      throw new Error(`No command "${cmd}"`);
    }
  } catch (err) {
    console.warn(err.message);
    if (args.trace) console.warn(err.stack);
    Deno.exit(1);
  }
}
