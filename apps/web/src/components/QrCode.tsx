import { useMemo } from 'react';
import { encode } from 'uqr';

/**
 * Presentational: a QR code drawn as one SVG path, so the card image keeps it sharp. The quiet
 * zone is the white box around it (ShareCard's .share-card__qr).
 */
export function QrCode({ value, size }: { value: string; size: number }) {
  const { path, modules } = useMemo(() => {
    const { data, size: count } = encode(value, { ecc: 'M', border: 0 });
    let d = '';
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, modules: count };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${modules} ${modules}`}
      width={size}
      height={size}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
