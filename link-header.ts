import { Link } from "./types.ts";

function createObjects(acc: any, p: any) {
  // rel="next" => 1: rel 2: next
  var m = p.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);
  if (m) acc[m[1]] = m[2];
  return acc;
}

function parseLink(link: string) {
  var m = link.match(/<?([^>]*)>(.*)/),
    linkUrl = m && m[1],
    parts = m && m[2] && m[2].split(";");
  if (parts) {
    parts.shift();
    var info = parts.reduce(createObjects, {});
    info.url = linkUrl;
    return info;
  }
}

export function parseLinkHeader(header?: string): Link[] {
  if (!header) return [];
  return header.split(/,\s*</).map(parseLink);
}

export function stringify(links: Link[]) {
  return links
    .map((link) => {
      const parts: string[] = [`<${link.url}>`];
      if (link.rel) parts.push(`rel="${link.rel}"`);
      return parts.join("; ");
    })
    .join(", ");
}
