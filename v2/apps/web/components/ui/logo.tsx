/** Ícone Overtrader — quadrado azul (#185FA5) com gráfico de alta + ponto. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden>
      <rect width="128" height="128" rx="24" fill="#185FA5" />
      <polyline points="18,96 38,62 54,76 80,38" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M80 38 H96 M80 38 V54" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="54" cy="108" r="7" fill="#fff" opacity="0.35" />
    </svg>
  );
}
