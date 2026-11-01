export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      <rect x="6" y="12" width="52" height="42" rx="18" fill="url(#logo-g)" />
      <rect x="13" y="22" width="38" height="20" rx="10" fill="#0B1024" />
      <circle cx="25" cy="32" r="4.5" fill="#7CF3FF" />
      <circle cx="39" cy="32" r="4.5" fill="#7CF3FF" />
      <circle cx="32" cy="6" r="4" fill="var(--cyan)" />
      <rect x="30.5" y="6" width="3" height="7" fill="var(--violet)" />
    </svg>
  )
}
