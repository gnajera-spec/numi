/**
 * NumiLogo — Identidad visual NUMI
 * Usa el PNG oficial extraído del Manual de Lineamientos Primarios v2
 * (página 17, ORIGINAL POSITIVO — isotipo naranja + wordmark azul/naranja).
 * NumiIsotipo SVG disponible para watermarks y fondos decorativos.
 */

interface NumiIsotipoProps {
  size?: number;
  color?: string;
}

interface NumiLogoProps {
  /** Altura de display en px. Default 28. */
  height?: number;
  /** Alias para compatibilidad — se usa como altura. */
  iconSize?: number;
  /** Aplica filter para renderizar el logo en blanco (para fondos oscuros/de color). */
  white?: boolean;
  /** No usado. Mantenido por compatibilidad. */
  iconColor?: string;
  textColor?: string;
  accentColor?: string;
  className?: string;
}

/* ── Isotipo SVG — para watermarks y variantes monocromáticas ─────────────── */
const NODES: [number, number][] = [
  [50,2],[3,26],[91,26],[77,38],[13,53],[3,74],[91,74],[63,77],[50,97],
];
const EDGES: [number, number][] = [
  [0,1],[0,2],[1,5],[2,6],[5,8],[6,8],
  [0,3],[1,3],[2,3],[1,4],[4,5],
  [3,4],[3,6],[3,7],[4,7],[4,8],[5,7],[6,7],[7,8],
];

export function NumiIsotipo({ size = 48, color = '#226080' }: NumiIsotipoProps) {
  const sw = Math.max(0.8, (1.8 * 48) / size);
  const dr = Math.max(1.2, (2.4 * 48) / size);
  return (
    <svg width={size} height={size} viewBox="0 0 95 100" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-label="NUMI isotipo">
      {EDGES.map(([a,b],i) => (
        <line key={`e${i}`} x1={NODES[a][0]} y1={NODES[a][1]}
          x2={NODES[b][0]} y2={NODES[b][1]}
          stroke={color} strokeWidth={sw} strokeLinecap="round" />
      ))}
      {NODES.map(([x,y],i) => (
        <circle key={`n${i}`} cx={x} cy={y} r={dr} fill={color} />
      ))}
    </svg>
  );
}

/* ── Logo oficial ─────────────────────────────────────────────────────────── */
export function NumiLogo({ height, iconSize, white, className }: NumiLogoProps) {
  const h = height ?? iconSize ?? 28;
  return (
    <img
      src="/logo--white.png"
      alt="NUMI"
      height={h}
      style={{
        display: 'block',
        width: 'auto',
        filter: white ? 'brightness(0) invert(1)' : undefined,
      }}
      className={className}
      draggable={false}
    />
  );
}
