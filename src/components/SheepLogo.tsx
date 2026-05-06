export function SheepLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Ullkollen">
      {/* Wool body - cloud-like */}
      <g fill="currentColor">
        <circle cx="22" cy="36" r="9" />
        <circle cx="32" cy="30" r="11" />
        <circle cx="44" cy="36" r="9" />
        <circle cx="26" cy="44" r="8" />
        <circle cx="40" cy="44" r="8" />
      </g>
      {/* Head */}
      <ellipse cx="48" cy="28" rx="7" ry="8" fill="currentColor" />
      {/* Ear */}
      <ellipse cx="52" cy="22" rx="2.5" ry="4" fill="currentColor" transform="rotate(25 52 22)" />
      {/* Eye */}
      <circle cx="50" cy="28" r="1.2" fill="var(--color-cream)" />
      {/* Legs */}
      <rect x="24" y="50" width="3" height="8" rx="1.5" fill="currentColor" />
      <rect x="38" y="50" width="3" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}
