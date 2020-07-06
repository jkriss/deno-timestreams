import { StreamReader, Post } from "./types.ts";
import { SEP, join } from "https://deno.land/std/path/mod.ts";
import { createHash } from "https://deno.land/std/hash/mod.ts";
import mime from "https://cdn.pika.dev/mime-types@^2.1.27";
import dayjs from "https://cdn.pika.dev/dayjs@^1.8.28";

interface ReaderOpts {
  path?: string;
}

const timePattern = new RegExp(`(\\d{2})(\\d{2})(\\d{2})Z`);
const dayPattern = new RegExp(`(\\d{4})(\\d{2})(\\d{2})`);
const pathWithTimePattern = new RegExp(
  `(\\d{4})${SEP}(\\d{2})${SEP}(\\d{2})${SEP}${timePattern}`
);
const pathWithDatePattern = new RegExp(
  `(\\d{4})${SEP}(\\d{2})${SEP}(\\d{2})${SEP}`
);

export class FileStreamReader implements StreamReader {
  rootDir: string;
  opts: ReaderOpts;
  constructor(opts: ReaderOpts = {}) {
    this.rootDir = opts.path || Deno.cwd();
    if (this.rootDir.startsWith("file://")) {
      this.rootDir = this.rootDir.replace(/^file:\/\//, "");
    }
    this.opts = opts;
  }
  private getPathForDate(date: Date): string {
    return date.toISOString().split("T")[0].replace(/-/g, SEP);
  }
  private getFiles(dir: string) {
    const d = join(this.rootDir, dir);
    try {
      const files = [];
      for (const f of Deno.readDirSync(d)) {
        files.push(f);
      }
      // make sure they're lexicographically sorted
      return files.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      if (err.name === "NotFound") return [];
      throw err;
    }
  }
  private getYears() {
    const years: string[] = [];
    for (const f of Deno.readDirSync(join(this.rootDir))) {
      if (f.isDirectory) years.push(f.name);
    }
    return years;
  }
  private async asPost(filename: string, date: Date | string): Promise<Post> {
    const contentType = mime.lookup(filename) || "application/octet-stream";
    const datePart =
      typeof date === "string"
        ? date
        : date
            .toISOString()
            .split("T")[0]
            .replace(/[-:]|\.\d+/g, "");
    let namePart = undefined;
    if (filename.match(pathWithTimePattern)) {
      namePart = filename.replace(pathWithTimePattern, "");
    } else {
      namePart = filename.replace(pathWithDatePattern, "");
    }
    namePart = namePart.replace(/\.\w+$/, "");
    const id = datePart + namePart;
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const fullPath = join(this.rootDir, filename);
    const stats = await Deno.lstat(fullPath);
    const headers = new Headers({
      "content-length": `${stats.size}`,
    });
    if (stats.mtime) {
      const modified = stats.mtime.toUTCString();
      headers.set("last-modified", modified);
      const hash = createHash("sha256");
      hash.update(modified);
      hash.update(fullPath);
      headers.set("etag", `W/"${hash.toString('base64')}"`);
    }
    return {
      id,
      version: "1",
      date: dateObj,
      contentType,
      headers,
      getReader: () => {
        return Deno.open(fullPath, { read: true });
      },
    };
  }
  async get(id: string): Promise<Post | undefined> {
    const dayMatch = id.match(dayPattern);
    if (!dayMatch) return undefined;
    const dayDir = dayMatch.slice(1).join(SEP);
    const m = id.match(timePattern);
    const name = id.slice(16);
    if (!m) return undefined;
    const timePart = m[0];
    const zeroTime = timePart === "000000Z";
    const prefix = [timePart, name].join("-");
    const files = await this.getFiles(dayDir);
    for (const f of files) {
      if (f.name.startsWith(prefix) || (zeroTime && f.name.startsWith(name))) {
        return this.asPost(join(dayDir, f.name), dayDir.replace(/\D/g, ""));
      }
    }
  }
  async before(date?: Date): Promise<Post | undefined> {
    if (!date) date = new Date();

    const years = this.getYears();
    const minYear = parseInt(years.sort().reverse()[0]);
    if (!years.includes(date.toISOString().split("-")[0])) return undefined;

    let checkDate = new Date(date);
    checkDate.setUTCHours(0);
    checkDate.setUTCMinutes(0);
    checkDate.setUTCSeconds(0);
    checkDate.setUTCMilliseconds(0);

    while (checkDate.getUTCFullYear() >= minYear) {
      const pathPrefix = this.getPathForDate(checkDate);
      const pathPrefixDateStr = pathPrefix.replace(/[/\\]/g, "-");
      // console.log("\nchecking prefix", pathPrefix)
      const files = await this.getFiles(pathPrefix);

      for await (const f of files) {
        // parse time if present, check against date
        const m = f.name.match(/^(\d{2})(\d{2})(\d{2})Z/);
        let fileTime = checkDate;
        if (m) {
          const dateStr = `${pathPrefixDateStr}T${m[1]}:${m[2]}:${m[3]}Z`;
          fileTime = new Date(dateStr);
        }
        // console.log("file time is", fileTime, "looking before", date)
        if (fileTime < date) {
          return this.asPost(join(pathPrefix, f.name), fileTime);
        }
      }
      // haven't found it yet, try the day before
      checkDate = dayjs(checkDate).subtract(1, "day").toDate();
    }

    return undefined;
  }
}
