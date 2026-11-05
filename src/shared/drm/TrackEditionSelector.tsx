/**
 * Dual-edition track selector + upfront cost badges (ANT-942 FR7).
 *
 * ON shows gas estimate + chain name; OFF shows "tanpa wallet, tanpa gas".
 * Buy pages must render this BEFORE any purchase action so the cost
 * difference is visible upfront.
 */

import React, { useEffect, useState } from 'react';
import { fetchGasEstimate, formatGasLine, type GasEstimateResult } from './gas';
import { chainLabel, type Track } from './tracks';

export type EditionOption = {
  track: Track;
  label: string;
  /** Chain id for ON editions (e.g. `eip155:84532`); undefined for OFF. */
  chain?: string;
};

export const TrackEditionSelector: React.FC<{
  editions: EditionOption[];
  value: Track;
  onChange: (track: Track) => void;
}> = ({ editions, value, onChange }) => {
  const [gas, setGas] = useState<Record<string, GasEstimateResult>>({});

  const selected = editions.find((e) => e.track === value) ?? editions[0];
  const editionsKey = editions.map((e) => `${e.track}:${e.chain ?? ''}`).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const onEditions = editions.filter((e) => e.track === 'onchain' && e.chain);
      const results = await Promise.all(onEditions.map((e) => fetchGasEstimate(e.chain!)));
      if (cancelled) return;
      const next: Record<string, GasEstimateResult> = {};
      for (const r of results) next[r.chain] = r;
      setGas(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionsKey]);

  if (editions.length <= 1 && editions[0]?.track === 'offchain') {
    return (
      <p className="text-xs opacity-70" data-testid="drm-cost-off">
        Edisi OFF — tanpa wallet, tanpa gas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="drm-edition-selector">
      <div className="flex gap-2" role="radiogroup" aria-label="Pilih edisi">
        {editions.map((edition) => (
          <button
            key={edition.track}
            type="button"
            role="radio"
            aria-checked={value === edition.track}
            onClick={() => onChange(edition.track)}
            className={[
              'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
              value === edition.track
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-foreground/20 text-muted-foreground hover:border-foreground/40',
            ].join(' ')}
          >
            {edition.label}
          </button>
        ))}
      </div>
      {selected?.track === 'onchain' ? (
        <p className="text-xs opacity-80" data-testid="drm-cost-on">
          {selected.chain
            ? (gas[selected.chain]
              ? formatGasLine(gas[selected.chain])
              : `Memuat estimasi gas (${chainLabel(selected.chain)})…`)
            : 'Biaya gas mengikuti jaringan.'}{' '}
          Estimasi, bukan harga final.
        </p>
      ) : (
        <p className="text-xs opacity-70" data-testid="drm-cost-off">
          Edisi OFF — tanpa wallet, tanpa gas.
        </p>
      )}
    </div>
  );
};
