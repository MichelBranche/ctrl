export function SwapText({ children }: { children: string }) {
  return (
    <span className="swap">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}
