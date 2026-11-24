/**
 * Videos from the CTRL® Agency YouTube channel (UCgirvfq-N2XXvpRQ0OL5tsw).
 *
 * The home "Studio film" section reads the public feed
 * https://www.youtube.com/feeds/videos.xml?channel_id=UCgirvfq-N2XXvpRQ0OL5tsw
 * on the server (cached for one hour). No YouTube API key. If the feed fails or
 * comes back empty, the catalog below is the fallback.
 *
 * The studio presentation stays first (it is the default video in the big
 * player). The remaining slots are the newest other uploads. Shorts are skipped
 * when the feed marks them as portrait (media:content height > width) or the
 * link is a /shorts/ URL: the home layout is a wide player plus a horizontal rail.
 *
 * Known videos keep their local webp poster in /public/images/home/videos so
 * those frames do not load from YouTube before play. New uploads use i.ytimg.com.
 */
import { cacheLife, cacheTag } from "next/cache";

export type CtrlVideo = {
  id: string;
  title: string;
  /** Seconds. Omitted when the public feed does not include a duration. */
  duration?: number;
  published: string;
  thumb: string;
};

/** The studio presentation: always first, it is the default video in the big player. */
export const CTRL_FILM_ID = "upTqsodkdo4";

export const CTRL_CHANNEL_ID = "UCgirvfq-N2XXvpRQ0OL5tsw";
export const CTRL_CHANNEL_URL = `https://www.youtube.com/channel/${CTRL_CHANNEL_ID}`;
export const CTRL_CHANNEL_FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CTRL_CHANNEL_ID}`;
export const CTRL_VIDEO_LIMIT = 4;

export const CTRL_VIDEOS: CtrlVideo[] = [
  {
    id: "upTqsodkdo4",
    title: "CTRL® , More Than a Creative Studio.",
    duration: 33,
    published: "2026-11-01",
    thumb: "/images/home/videos/upTqsodkdo4.webp",
  },
  {
    id: "0pf4jBsvAac",
    title: "SBRANO® , A Bold Food Brand Experience | Branding, Web Design & UI/UX Showcase",
    duration: 42,
    published: "2026-11-01",
    thumb: "/images/home/videos/0pf4jBsvAac.webp",
  },
  {
    id: "o_IYpKN28Ck",
    title: "VOLT , Your Computer. Your AI. Your Rules. | Local AI Assistant",
    duration: 40,
    published: "2026-11-02",
    thumb: "/images/home/videos/o_IYpKN28Ck.webp",
  },
  {
    id: "0ZbTfrsfgcM",
    title: "Agenda Easy | Your Schedule. Finally Simple.🌿",
    duration: 48,
    published: "2026-11-02",
    thumb: "/images/home/videos/0ZbTfrsfgcM.webp",
  },
];

const KNOWN = new Map(CTRL_VIDEOS.map((video) => [video.id, video]));

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1].trim()) : "";
}

function attr(block: string, name: string, attrName: string) {
  const match = block.match(new RegExp(`<${name}[^>]*\\s${attrName}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function thumbnailFor(id: string) {
  const known = KNOWN.get(id)?.thumb;
  if (known?.startsWith("/")) return known;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function enrich(video: CtrlVideo): CtrlVideo {
  const known = KNOWN.get(video.id);
  return {
    ...video,
    duration: known?.duration ?? video.duration,
    thumb: known?.thumb?.startsWith("/") ? known.thumb : video.thumb,
    title: video.title || known?.title || video.title,
  };
}

/** Light Atom parse of the public YouTube channel feed. Exported for a local check. */
export function parseYouTubeFeed(xml: string): CtrlVideo[] {
  const videos: CtrlVideo[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1];
    const id = tag(block, "yt:videoId");
    if (!/^[\w-]{11}$/.test(id) || seen.has(id)) continue;
    const title = tag(block, "title");
    if (!title) continue;
    const href = attr(block, "link", "href");
    const width = Number(attr(block, "media:content", "width") || 0);
    const height = Number(attr(block, "media:content", "height") || 0);
    // The home player is landscape; drop Shorts when the feed makes them obvious.
    if (href.includes("/shorts/") || (width > 0 && height > width)) continue;
    const published = (tag(block, "published") || "").slice(0, 10);
    seen.add(id);
    videos.push(enrich({ id, title, published, thumb: thumbnailFor(id) }));
  }
  return videos;
}

function assemble(feed: CtrlVideo[]): CtrlVideo[] {
  const studio = feed.find((video) => video.id === CTRL_FILM_ID) ?? KNOWN.get(CTRL_FILM_ID);
  const rest = feed.filter((video) => video.id !== CTRL_FILM_ID);
  const list = (studio ? [studio, ...rest] : rest).slice(0, CTRL_VIDEO_LIMIT);
  return list.length ? list : CTRL_VIDEOS;
}

async function readChannelFeed(): Promise<CtrlVideo[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 * 7 });
  cacheTag("ctrl-videos");
  const res = await fetch(CTRL_CHANNEL_FEED, {
    headers: { Accept: "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`youtube feed ${res.status}`);
  const videos = parseYouTubeFeed(await res.text());
  if (!videos.length) throw new Error("youtube feed empty");
  return videos;
}

/** Latest channel videos for the home Studio film section, with a static fallback. */
export async function getStudioVideos(): Promise<CtrlVideo[]> {
  try {
    return assemble(await readChannelFeed());
  } catch (error) {
    console.error("[ctrl-videos]", error instanceof Error ? error.message : "feed failed");
    return CTRL_VIDEOS;
  }
}
