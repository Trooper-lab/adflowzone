export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}
    >
      <svg
        className="absolute inset-0 w-full h-full select-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="go-grid-mesh" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.5" />
            <circle cx="0"  cy="0"  r="1" fill="rgba(255,255,255,0.07)" />
            <circle cx="80" cy="0"  r="1" fill="rgba(255,255,255,0.07)" />
            <circle cx="0"  cy="80" r="1" fill="rgba(255,255,255,0.07)" />
            <circle cx="80" cy="80" r="1" fill="rgba(255,255,255,0.07)" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#go-grid-mesh)" />

        {/* Top-right polar rings */}
        <g transform="translate(1200, 200)" stroke="rgba(255,255,255,0.045)" fill="none">
          <circle r="150" strokeWidth="0.5" strokeDasharray="3 6" />
          <circle r="300" strokeWidth="0.75" />
          <circle r="450" strokeWidth="0.5" strokeDasharray="12 6" />
          <circle r="600" strokeWidth="1" strokeDasharray="40 20 10 20" />
          <circle r="750" strokeWidth="0.5" />
          <line x1="0" y1="0" x2="-800" y2="300" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="0" x2="-600" y2="700" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="0" x2="-300" y2="900" strokeWidth="0.5" strokeDasharray="4 4" />
        </g>

        {/* Bottom-left polar rings */}
        <g transform="translate(100, 800)" stroke="rgba(255,255,255,0.035)" fill="none">
          <circle r="200" strokeWidth="0.5" strokeDasharray="6 6" />
          <circle r="400" strokeWidth="0.75" strokeDasharray="24 8" />
          <circle r="600" strokeWidth="1" />
          <circle r="800" strokeWidth="0.5" strokeDasharray="10 20" />
          <line x1="0" y1="0" x2="800" y2="-300" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="0" x2="600" y2="-700" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="0" x2="300" y2="-900" strokeWidth="0.5" strokeDasharray="4 4" />
        </g>

        {/* Central slow-rotating dial */}
        <circle cx="720" cy="450" r="400" stroke="rgba(255,255,255,0.02)" strokeWidth="0.75" strokeDasharray="60 120" fill="none">
          <animateTransform attributeName="transform" type="rotate" from="0 720 450" to="360 720 450" dur="180s" repeatCount="indefinite" />
        </circle>

        {/* Corner telemetry labels */}
        <g fill="rgba(255,255,255,0.15)" fontSize="8" fontFamily="monospace" letterSpacing="0.15em">
          <text x="24" y="36">GO.LOC // 52° 22′ N, 4° 54′ E</text>
          <text x="24" y="48">SYSTEM.STABLE // DATA.STREAM.OK</text>
          <text x="1416" y="854" textAnchor="end">SECTOR.GRID.01 // GO_CORE_SYS</text>
          <text x="1416" y="866" textAnchor="end">LATITUDE.OVERVIEW.UPSTREAM</text>
        </g>
      </svg>
    </div>
  );
}
