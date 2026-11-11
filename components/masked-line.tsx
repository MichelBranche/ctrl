/** One animated line: the real sentence stays available to assistive tech, and the split letters are hidden from it. */
export function MaskedLine({ text, mask }: { text: string; mask: "hero" | "scroll" | "footer" }) {
  return (
    <span className="line-mask">
      <span className="u-sr">{text}</span>
      <span data-mask={mask} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
