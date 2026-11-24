import { cacheLife, cacheTag } from "next/cache";
import {
  assembleStudioVideos,
  CTRL_CHANNEL_FEED,
  CTRL_VIDEOS,
  parseYouTubeFeed,
  type CtrlVideo,
} from "@/lib/ctrl-videos";

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
    return assembleStudioVideos(await readChannelFeed());
  } catch (error) {
    console.error("[ctrl-videos]", error instanceof Error ? error.message : "feed failed");
    return CTRL_VIDEOS;
  }
}
