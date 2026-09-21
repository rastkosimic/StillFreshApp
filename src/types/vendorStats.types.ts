/** Per-location or chain-aggregated stats from GET /vendors/stats or chain/stats. */
export interface VendorStatsSummary {
  totalUnitsSold: number;
  totalVendorEarningsCents: number;
  totalPlatformFeeCents: number;
  totalGrossRevenueCents: number;
  breakdown?: unknown[];
}

/** Single-vendor stats — GET /vendors/stats (branch admins). */
export interface VendorStatsResponse extends VendorStatsSummary {
  from?: string | null;
  to?: string | null;
}

export interface ChainLocationStatsEntry {
  vendorId: number;
  locationName: string;
  /** Jackson may emit `isHeadquarters` or `headquarters` depending on getter naming. */
  isHeadquarters?: boolean;
  headquarters?: boolean;
  stats?: VendorStatsSummary;
  /** Present when this location's stats could not be loaded (HTTP 200 partial failure). */
  error?: string;
}

/** HQ chain-wide stats — GET /vendors/chain/stats (headquarters VENDOR_ADMIN only). */
export interface ChainStatsResponse {
  chainId: string;
  chainName: string;
  from: string | null;
  to: string | null;
  chainTotals: VendorStatsSummary;
  locations: ChainLocationStatsEntry[];
}

export interface StatsDateRangeParams {
  from?: string;
  to?: string;
}
