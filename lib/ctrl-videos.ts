/**
 * Videos from the CTRL® Agency YouTube channel (UCgirvfq-N2XXvpRQ0OL5tsw).
 *
 * Source: the public feed https://www.youtube.com/feeds/videos.xml?channel_id=UCgirvfq-N2XXvpRQ0OL5tsw
 * (ID, title, publish date, read on 2026-11-20). Durations come from each public
 * watch page (lengthSeconds). Thumbnails are the channel's own maxresdefault
 * frames, saved as webp in /public/images/home/videos so nothing loads from
 * YouTube before the visitor presses play. Add new uploads here by hand: real
 * channel videos only.
 */
export type CtrlVideo = {
  id: string;
  title: string;
  /** Seconds. */
  duration: number;
  published: string;
  thumb: string;
};

/** The studio presentation: always first, it is the default video in the big player. */
export const CTRL_FILM_ID = "upTqsodkdo4";

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

export const CTRL_CHANNEL_URL = "https://www.youtube.com/channel/UCgirvfq-N2XXvpRQ0OL5tsw";

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
