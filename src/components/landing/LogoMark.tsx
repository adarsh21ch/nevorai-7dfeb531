/**
 * Nevorai n+dot mark — inline SVG using currentColor so it inverts
 * automatically based on the active theme's --logo-color token.
 *
 * Stylized "n" with a punctuating dot. Dot has a subtle 3s opacity
 * pulse via the .logo-dot-pulse CSS class (defined in styles.css).
 */
export const LogoMark = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >

    {/* n stem (left vertical) */}
    <rect x="10" y="20" width="9" height="34" rx="2" fill="currentColor" />
    {/* n arch — curve from left stem up and over to right */}
    <path
      d="M19 30 C 19 20, 35 14, 45 22 L 45 54 L 36 54 L 36 28 C 33 24, 24 25, 19 30 Z"
      fill="currentColor"
    />
    {/* dot above the right side */}
    <circle
      cx="49"
      cy="14"
      r="5"
      fill="currentColor"
      className="logo-dot-pulse"
    />
  </svg>
);
