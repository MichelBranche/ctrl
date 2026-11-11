"use client";

import { useState, type CSSProperties } from "react";
import { marqueeRepeats, type PresentedReviews } from "@/lib/google-reviews-core";

function Stars({ count }: { count: number }) {
  return (
    <span className="h-review-stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 16 16" className={index < count ? "is-on" : undefined}>
          <path d="M8 1.4 9.9 5.8l4.8.4-3.6 3.2 1.1 4.7L8 11.8 3.8 14.1 4.9 9.4 1.3 6.2l4.8-.4z" />
        </svg>
      ))}
    </span>
  );
}

/** Slim Google review strip. The server passes real Places text, or the dev fixture. */
export function HeroReviews({ data }: { data: PresentedReviews }) {
  const [paused, setPaused] = useState(false);
  const repeats = marqueeRepeats(data.reviews.length);
  const loop = Array.from({ length: repeats }, () => data.reviews).flat();
  const duration = Math.max(36, loop.length * 8);

  return (
    <section className="h-reviews" aria-label={data.metaLabel} data-paused={paused ? "" : undefined} data-fixture={data.fixture ? "" : undefined}>
      <div className="h-reviews-meta">
        <a className="h-reviews-source" href={data.mapsUri} target="_blank" rel="noopener noreferrer">
          {data.ratingLabel ? <span className="h-reviews-score">{data.ratingLabel}</span> : null}
          {data.countLabel ? <span className="h-reviews-count">{data.countLabel}</span> : null}
          <span>{data.attribution}</span>
        </a>
        {data.fixtureLabel ? <span className="h-reviews-fixture">{data.fixtureLabel}</span> : null}
      </div>
      <button type="button" className="h-reviews-pause" onClick={() => setPaused((value) => !value)}>
        {paused ? data.play : data.pause}
      </button>
      <div className="h-reviews-viewport">
        <div className="h-reviews-track" style={{ "--h-reviews-duration": `${duration}s` } as CSSProperties}>
          {[false, true].map((clone) => (
            <ul key={clone ? "clone" : "live"} className="h-reviews-set" data-clone={clone ? "" : undefined} aria-hidden={clone || undefined}>
              {loop.map((review, index) => (
                <li className="h-review" key={`${review.id}-${index}`}>
                  <div className="h-review-top">
                    <Stars count={review.stars} />
                    <span className="h-sr">{review.starLabel}</span>
                    {review.when ? <time dateTime={review.publishedAt}>{review.when}</time> : null}
                  </div>
                  {review.authorUri ? (
                    <a className="h-review-author" href={review.authorUri} target="_blank" rel="noopener noreferrer">
                      {review.author}
                    </a>
                  ) : (
                    <p className="h-review-author">{review.author}</p>
                  )}
                  <p className="h-review-text" title={review.text}>{review.text}</p>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
