export type DashboardPeriod = 'today' | 'week' | 'month' | 'all';

export interface PeriodSummary {
  totalUnitsSold: number;
  totalUnitsListed: number;
  totalVendorEarningsCents: number;
  totalPlatformFeeCents: number;
  totalGrossRevenueCents: number;
  /** @deprecated Gross sales in major units — do not label as vendor profit */
  totalRevenue?: number;
  activeOrderCount: number;
  /** 0–1 fraction; -1 when unitsListed == 0 (not computable) */
  sellThroughRate: number;
}

export interface DailyRevenueStat {
  date: string;
  vendorEarningsCents: number;
  platformFeeCents: number;
  grossRevenueCents: number;
  /** @deprecated Gross sales in major units */
  revenue?: number;
}

export interface SellThroughDailyStat {
  date: string;
  unitsListed: number;
  unitsSold: number;
  /** 0–1 fraction; -1 when unitsListed == 0 */
  sellThroughRate: number;
}

export interface OfferPerformance {
  offerId: number;
  offerName: string | null;
  /** Legacy first-publish size — do not use for STR display */
  originalQuantity: number;
  quantityAvailable: number;
  unitsListed: number;
  unitsSold: number;
  vendorEarningsCents: number;
  platformFeeCents: number;
  grossRevenueCents: number;
  /** @deprecated Gross sales in major units */
  revenue?: number;
  sellThroughRate: number;
  active: boolean;
}

export interface CompletedOrderSummary {
  orderId: number | null;
  offerId?: number | null;
  offerName?: string | null;
  quantity?: number;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  feePercentApplied: number | null;
  currency: string | null;
  settledAt: string | null;
}

export interface DashboardActiveOrder {
  orderId: number | null;
  offerId: number | null;
  quantity: number;
  totalPrice: number;
  currency: string | null;
  status: string | null;
  pickupBy: string | null;
  paymentMethod: string | null;
}

export interface RatingSummary {
  averageRating: number;
  reviewsCount: number;
}

export interface PayoutSummary {
  unsettledCents: number;
  currency: string | null;
  lastPayoutAmountCents: number | null;
  lastPayoutAt: string | null;
}

export interface VendorDashboardResponse {
  vendorId: number;
  period: string;
  selectedOfferIds: number[] | null;
  generatedAt: string;
  summary: PeriodSummary | null;
  periodBenchmark: PeriodSummary | null;
  revenueTrend: DailyRevenueStat[] | null;
  sellThroughTrend: SellThroughDailyStat[] | null;
  offerPerformance: OfferPerformance[] | null;
  completedOrdersInPeriod: CompletedOrderSummary[] | null;
  recentCompletedOrders: CompletedOrderSummary[] | null;
  activeOrders: DashboardActiveOrder[] | null;
  ratings: RatingSummary | null;
  payoutBalance: PayoutSummary | null;
}
