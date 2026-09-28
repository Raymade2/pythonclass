export function SchoolLogo({ size = 40, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="School logo" role="img">
      <circle cx="32" cy="32" r="30" fill="#0b1a4b" stroke="#fcb422" strokeWidth="2.5" />
      <path d="M32 14 L52 23 L32 32 L12 23 Z" fill="#fcb422" />
      <path d="M20 28.5 V38 C20 42 26 45.5 32 45.5 C38 45.5 44 42 44 38 V28.5 L32 34 Z" fill="#ffffff" />
      <rect x="49" y="23" width="2.6" height="14" rx="1.3" fill="#fcb422" />
      <circle cx="50.3" cy="39" r="2.6" fill="#fcb422" />
      <text x="32" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fcb422" fontFamily="system-ui, sans-serif">
        SFGS
      </text>
    </svg>
  );
}
