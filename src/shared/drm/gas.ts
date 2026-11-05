/**
 * Gas-estimate data for the ON-track buy badge (ANT-942 FR7 / AC#15).
 *
 * Source: `GET /internal/onchain/gas-estimate?chain=...` (Troy, ANT-941).
 * Values are estimates measured on local EDR — the UI MUST label them
 * as estimates, never as quotes.
 */

import { chainLabel } from './tracks';

export interface GasEstimate {
  buyGas: number;
  revokeGas: number;
  note: string;
}

export interface GasEstimateResult {
  chain: string;
  chainName: string;
  estimate: GasEstimate | null;
}

const apiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

export async function fetchGasEstimate(chain: string): Promise<GasEstimateResult> {
  const base = apiBase();
  if (!base) return { chain, chainName: chainLabel(chain), estimate: null };
  try {
    const res = await fetch(
      `${base}/internal/onchain/gas-estimate?chain=${encodeURIComponent(chain)}`,
    );
    if (!res.ok) return { chain, chainName: chainLabel(chain), estimate: null };
    const json = (await res.json()) as {
      data?: { chain?: string; estimate?: GasEstimate | null };
      chain?: string;
      estimate?: GasEstimate | null;
    };
    const data = json.data ?? json;
    return {
      chain,
      chainName: chainLabel(chain),
      estimate: data.estimate ?? null,
    };
  } catch {
    return { chain, chainName: chainLabel(chain), estimate: null };
  }
}

export function formatGasLine(result: GasEstimateResult): string {
  if (!result.estimate) return `Estimasi gas tidak tersedia (${result.chainName})`;
  return `Estimasi gas ±${result.estimate.buyGas.toLocaleString('id-ID')} (${result.chainName})`;
}
