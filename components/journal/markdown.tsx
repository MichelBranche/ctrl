import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Only http(s), mailto, relative and in-page links/images survive. */
function safeUrl(url: string) {
  const out = defaultUrlTransform(url);
  return /^(https?:|mailto:|\/|#)/i.test(out) ? out : "";
}

/**
 * Safe Markdown: raw HTML is dropped (skipHtml, no rehype-raw), unsafe URL
 * schemes are stripped, external links open with noopener.
 */
export function PostBody({ source }: { source: string }) {
  return (
    <div className="j-prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeUrl}
        components={{
          a: ({ href = "", children }) =>
            /^https?:/i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            ) : (
              <a href={href}>{children}</a>
            ),
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary author URLs; sizes unknown
          img: ({ src, alt }) => (typeof src === "string" && src ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null),
          h1: ({ children }) => <h2>{children}</h2>,
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}
