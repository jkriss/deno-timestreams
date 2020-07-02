import { StreamReader, Post } from './types.ts'
import { SEP, join } from "https://deno.land/std/path/mod.ts";
import mime from "https://cdn.pika.dev/mime-types@^2.1.27";
import dayjs from 'https://cdn.pika.dev/dayjs@^1.8.28';

interface ReaderOpts {
  baseDir?: string
}

const dayFormat = 'YYYY/MM/dd'

export class FileStreamReader implements StreamReader {
  name:string
  opts: ReaderOpts
  constructor(name:string, opts:ReaderOpts={}) {
    this.name = name
    this.opts = opts
  }
  get rootDir():string {
    return join(this.opts.baseDir || Deno.cwd(), this.name+'.timestream')
  }
  private getPathForDate(date:Date):string {
    return date.toISOString().split('T')[0].replace(/-/g, SEP)
  }
  private getFiles(dir:string) {
    const d = join(this.rootDir, dir)
    // console.log("listing files in", d)
    try {
      const files = []
      for (const f of Deno.readDirSync(d)) {
        files.push(f)
      }
      return files.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
    
    } catch (err) {
      if (err.name === 'NotFound') return []
      throw err
    }
  }
  private getYears() {
    const years:string[] = []
    for (const f of Deno.readDirSync(join(this.rootDir))) {
      if (f.isDirectory) years.push(f.name)
    }
    return years
  }
  private async asPost(filename:string): Post {
    const contentType = mime.lookup(filename)
    const file = await Deno.open(join(this.rootDir, filename), { read: true });
    return {
      contentType,
      body: file
    }
  }
  async before(date?:Date):Promise<Post|undefined> {
    if (!date) date = new Date()

    const years = this.getYears()
    const minYear = parseInt(years.sort().reverse()[0])
    if (!years.includes(date.toISOString().split('-')[0])) return undefined

    let checkDate = new Date(date)
    checkDate.setUTCHours(0)
    checkDate.setUTCMinutes(0)
    checkDate.setUTCSeconds(0)
    checkDate.setUTCMilliseconds(0)

    while (checkDate.getUTCFullYear() >= minYear) {
      const pathPrefix = this.getPathForDate(checkDate)
      const pathPrefixDateStr = pathPrefix.replace(/[/\\]/g,'-')
      console.log("\nchecking prefix", pathPrefix)
      const files = await this.getFiles(pathPrefix)
      
      console.log("sorted files:", files)
      for await (const f of files) {
        // parse time if present, check against date
        const m = f.name.match(/^(\d{2})(\d{2})(\d{2})Z/)
        let fileTime = checkDate
        if (m) {
          const dateStr = `${pathPrefixDateStr}T${m[1]}:${m[2]}:${m[3]}Z`
          console.log("parsing date", dateStr)
          fileTime = new Date(dateStr)
        }
        console.log("file time is", fileTime, "looking before", date)
        if (fileTime < date) {
          return this.asPost(join(pathPrefix, f.name))
        }
      }
      // haven't found it yet, try the day before
      checkDate = dayjs(checkDate).subtract(1, 'day').toDate()
      console.log("checkDate is now", checkDate.toISOString())
    }

    
    return undefined
  }
}