/**
 * The hero object: three rigid plates drawn in CSS 3D (no video, no bitmap),
 * so the engraved CTRL stays sharp at any size. Bottom to top: the grey base
 * with its grid of holes (software), the orange CTRL plate (brand), the glass
 * sheet with a website wireframe (site). The CSS default is the open state,
 * which is also what reduced motion and no-JS visitors see; HomeMotionV2
 * closes the stack on load and opens it with GSAP.
 */
function Layers({ count, className }: { count: number; className: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={className} style={{ "--i": i } as React.CSSProperties} aria-hidden="true" />
      ))}
    </>
  );
}

export function HomePlates({ label }: { label: string }) {
  return (
    <div className="hp-scene" role="img" aria-label={label} data-plates>
      <div className="hp-tilt">
        <div className="hp-spin" data-plates-spin>
          <i className="hp-shadow" aria-hidden="true" data-plates-shadow />

          <div className="hp-plate hp-base" data-plate="base">
            <Layers count={12} className="hp-edge" />
            <div className="hp-face">
              <span className="hp-holes" />
              <span className="hp-led" />
            </div>
          </div>

          <div className="hp-plate hp-brand" data-plate="brand">
            <Layers count={7} className="hp-edge" />
            <div className="hp-face">
              <span className="hp-engrave">
                CTRL<sup>®</sup>
              </span>
            </div>
          </div>

          <div className="hp-plate hp-glass" data-plate="glass">
            <Layers count={3} className="hp-edge" />
            <div className="hp-face">
              <svg className="hp-wire" viewBox="0 0 380 260" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <rect x="18" y="16" width="344" height="228" rx="10" />
                  <path d="M18 44h344" />
                  <circle cx="34" cy="30" r="3.4" />
                  <path d="M296 30h50M246 30h36" />
                  <rect x="36" y="62" width="168" height="16" rx="3" />
                  <path d="M36 92h132M36 104h108" />
                  <rect x="36" y="122" width="62" height="18" rx="9" />
                  <rect x="222" y="62" width="122" height="94" rx="6" />
                  <path d="M222 156l40-38 26 24 18-16 38 30" />
                  <rect x="36" y="176" width="92" height="52" rx="6" />
                  <rect x="144" y="176" width="92" height="52" rx="6" />
                  <rect x="252" y="176" width="92" height="52" rx="6" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
