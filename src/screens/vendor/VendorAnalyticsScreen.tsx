import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AnalyticsLocationFilterModal from '@/components/AnalyticsLocationFilterModal';
import AnalyticsOfferFilterModal from '@/components/AnalyticsOfferFilterModal';
import { useVendorIdentity } from '@/hooks/useVendorIdentity';
import { VendorTabScreenProps } from '@/navigation/types';
import {
  getAllOffers,
  getChainLocations,
  getDashboard,
  getVendorRatingSummary,
} from '@/services/vendorService';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme/colors';
import {
  ChainLocation,
  CompletedOrderSummary,
  DashboardActiveOrder,
  DashboardPeriod,
  Offer,
  OfferPerformance,
  OrderStatus,
  PeriodSummary,
  SellThroughDailyStat,
  VendorDashboardResponse,
  VendorRatingSummary,
} from '@/types';
import { ApiError } from '@/types/api.types';
import {
  chartAxisLabel,
  fmtShortCents,
  formatSellThroughRate,
  isOfferFilterActive,
  resolveCompletedOrders,
  sellThroughPercent,
} from '@/utils/dashboardFormat';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatInstant, formatPickupDeadline } from '@/utils/formatDate';
import { formatOrderAmount } from '@/utils/formatOrderAmount';
import { orderStatusColor, orderStatusI18nKey } from '@/utils/orderStatus';

type Props = VendorTabScreenProps<'Analytics'>;

const CHART_BAR_AREA = 88;
const OFFERS_PREVIEW = 3;
const PERIODS: DashboardPeriod[] = ['all', 'today', 'week', 'month'];

const cardShadow: ViewStyle = {
  shadowColor: colors.text.primary,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};

const cardStyle: ViewStyle = {
  marginHorizontal: 12,
  backgroundColor: colors.surface,
  borderRadius: 14,
  padding: 16,
  ...cardShadow,
};

function periodI18nKey(period: DashboardPeriod): string {
  const keys: Record<DashboardPeriod, string> = {
    today: 'analytics.periodToday',
    week: 'analytics.periodWeek',
    month: 'analytics.periodMonth',
    all: 'analytics.periodAll',
  };
  return keys[period];
}

function revenueChartTitle(period: DashboardPeriod): string {
  const keys: Record<DashboardPeriod, string> = {
    today: 'analytics.chartTitleToday',
    week: 'analytics.chartTitleWeek',
    month: 'analytics.chartTitleMonth',
    all: 'analytics.chartTitleAll',
  };
  return keys[period];
}

function strChartTitle(period: DashboardPeriod): string {
  const keys: Record<DashboardPeriod, string> = {
    today: 'analytics.strChartTitleToday',
    week: 'analytics.strChartTitleWeek',
    month: 'analytics.strChartTitleMonth',
    all: 'analytics.strChartTitleAll',
  };
  return keys[period];
}

function computeBreakdown(
  breakdown: Record<string, number>,
): Array<{ star: number; pct: number }> {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    pct: total > 0 ? Math.round(((breakdown[String(star)] ?? 0) / total) * 100) : 0,
  }));
}

function starsStr(rating: number): string {
  const full = Math.min(5, Math.max(0, Math.round(rating)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function resolveCurrency(
  dashboard: VendorDashboardResponse | null,
  fallback = 'RSD',
): string {
  return dashboard?.payoutBalance?.currency ?? fallback;
}

function benchmarkEarningsSub(
  benchmark: PeriodSummary,
  currency: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t('analytics.benchmarkEarnings', {
    total: formatCurrency(benchmark.totalVendorEarningsCents, currency),
  });
}

function benchmarkUnitsSub(
  summary: PeriodSummary,
  benchmark: PeriodSummary,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t('analytics.benchmarkUnitsSold', {
    selected: summary.totalUnitsSold,
    total: benchmark.totalUnitsSold,
  });
}

function benchmarkStrSub(
  summary: PeriodSummary,
  benchmark: PeriodSummary,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t('analytics.benchmarkStr', {
    selected: formatSellThroughRate(summary.sellThroughRate),
    total: formatSellThroughRate(benchmark.sellThroughRate),
  });
}

export default function VendorAnalyticsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { identity, isLoading: identityLoading } = useVendorIdentity();

  const canChooseLocation =
    !identityLoading &&
    identity.isChainLocation &&
    identity.isHeadquarters &&
    identity.isAdmin;

  const [period, setPeriod] = useState<DashboardPeriod>('all');
  const [dashboard, setDashboard] = useState<VendorDashboardResponse | null>(null);
  const [chainLocations, setChainLocations] = useState<ChainLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<VendorRatingSummary | null>(null);
  const [vendorOffers, setVendorOffers] = useState<Offer[]>([]);
  const [appliedOfferIds, setAppliedOfferIds] = useState<number[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);

  const vendorId = user?.vendor?.id ?? null;
  const statsVendorId = selectedLocationId ?? vendorId;

  const selectedLocation = useMemo(
    () => chainLocations.find((loc) => loc.id === selectedLocationId) ?? null,
    [chainLocations, selectedLocationId],
  );

  const loadChainLocations = useCallback(async () => {
    if (!canChooseLocation || vendorId == null) {
      setChainLocations([]);
      setSelectedLocationId(vendorId);
      return;
    }
    try {
      const rows = await getChainLocations();
      setChainLocations(rows);
      setSelectedLocationId((current) => {
        if (current != null && rows.some((r) => r.id === current)) return current;
        return rows.find((r) => r.isHeadquarters)?.id ?? vendorId;
      });
    } catch {
      setChainLocations([]);
      setSelectedLocationId(vendorId);
    }
  }, [canChooseLocation, vendorId]);

  useEffect(() => {
    if (identityLoading) return;
    void loadChainLocations();
  }, [identityLoading, loadChainLocations]);

  useEffect(() => {
    if (!statsVendorId) return;
    if (statsVendorId === vendorId) {
      getAllOffers()
        .then(setVendorOffers)
        .catch(() => setVendorOffers([]));
    }
  }, [statsVendorId, vendorId]);

  useEffect(() => {
    if (statsVendorId == null || statsVendorId === vendorId) return;
    const rows = dashboard?.offerPerformance ?? [];
    setVendorOffers(
      rows.map(
        (offer): Offer => ({
          id: offer.offerId,
          vendorId: statsVendorId,
          name: offer.offerName ?? '—',
          price: 0,
          currency: 'RSD',
          quantityAvailable: 0,
          address: '',
          active: offer.active,
        }),
      ),
    );
  }, [dashboard?.offerPerformance, statsVendorId, vendorId]);

  const onSelectLocation = useCallback((locationId: number) => {
    setSelectedLocationId(locationId);
    setAppliedOfferIds([]);
    setShowAllOffers(false);
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      if (!statsVendorId) return;
      if (identityLoading) return;
      if (!silent) setIsLoading(true);
      const offerIds = appliedOfferIds.length > 0 ? appliedOfferIds : undefined;
      const [dashResult, ratingResult] = await Promise.allSettled([
        getDashboard(statsVendorId, period, offerIds),
        getVendorRatingSummary(statsVendorId),
      ]);
      if (dashResult.status === 'fulfilled') {
        setDashboard(dashResult.value);
      } else {
        setDashboard(null);
        const err = dashResult.reason as ApiError;
        if (err.status === 400) {
          setAppliedOfferIds([]);
          Alert.alert(t('common.error'), t('analytics.offerFilterInvalid'));
        }
      }
      if (ratingResult.status === 'fulfilled') {
        setRatingSummary(ratingResult.value);
      }
      if (!silent) setIsLoading(false);
    },
    [statsVendorId, period, appliedOfferIds, identityLoading, t],
  );

  useEffect(() => {
    setShowAllOffers(false);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadChainLocations(), loadData(true)]);
    setIsRefreshing(false);
  }, [loadChainLocations, loadData]);

  const currency = useMemo(() => resolveCurrency(dashboard), [dashboard]);

  const summary = dashboard?.summary ?? null;
  const periodBenchmark = dashboard?.periodBenchmark ?? null;
  const isFiltered = isOfferFilterActive(dashboard);
  const showBenchmark = isFiltered && periodBenchmark != null;
  const revenueTrend = dashboard?.revenueTrend;
  const sellThroughTrend = dashboard?.sellThroughTrend;
  const offerPerformance = dashboard?.offerPerformance;
  const activeOrders = dashboard?.activeOrders;
  const completedOrders = useMemo(() => resolveCompletedOrders(dashboard), [dashboard]);
  const ratings = dashboard?.ratings;
  const payoutBalance = dashboard?.payoutBalance;

  const trend = revenueTrend ?? [];
  const maxEarnings = trend.reduce((m, p) => Math.max(m, p.vendorEarningsCents), 0);
  const showRevenueLabels = trend.length <= 8;

  const strTrend = sellThroughTrend ?? [];
  const maxStrUnits = strTrend.reduce(
    (m, p) => Math.max(m, p.unitsListed, p.unitsSold),
    0,
  );
  const showStrLabels = strTrend.length <= 8;

  const allOffers = offerPerformance ?? [];
  const visibleOffers = showAllOffers ? allOffers : allOffers.slice(0, OFFERS_PREVIEW);

  const breakdown = ratingSummary?.ratingBreakdown
    ? computeBreakdown(ratingSummary.ratingBreakdown)
    : null;

  const avgRating = ratings?.averageRating ?? ratingSummary?.averageRating ?? null;
  const reviewCount = ratings?.reviewsCount ?? ratingSummary?.totalRatings ?? 0;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary.DEFAULT}
        />
      }
    >
      <View
        className="bg-background px-5 pb-3.5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="text-[28px] font-bold text-primary mb-3.5 text-center">
          {t('analytics.title')}
        </Text>
        <View className="flex-row bg-border rounded-[10px] p-0.5">
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              activeOpacity={0.7}
              className="flex-1 py-1.5 rounded-lg items-center"
              style={{
                backgroundColor: period === p ? colors.surface : 'transparent',
                ...(period === p ? cardShadow : {}),
                shadowOpacity: period === p ? 0.12 : 0,
              }}
            >
              <Text
                className="text-xs"
                style={{
                  fontWeight: period === p ? '600' : '500',
                  color: period === p ? colors.text.primary : colors.text.secondary,
                }}
              >
                {t(periodI18nKey(p))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
          className="flex-row items-center gap-2 mt-3 py-2 px-3 rounded-xl bg-primary-50 border border-primary-100"
        >
          <Feather name="filter" size={16} color={colors.primary.DEFAULT} />
          <Text className="text-sm font-semibold text-primary flex-1">
            {appliedOfferIds.length === 0
              ? t('analytics.offerFilterAll')
              : t('analytics.offerFilterSelected', { count: appliedOfferIds.length })}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.primary.DEFAULT} />
        </TouchableOpacity>
        {canChooseLocation && chainLocations.length > 0 && (
          <TouchableOpacity
            onPress={() => setLocationModalVisible(true)}
            activeOpacity={0.7}
            className="flex-row items-center gap-2 mt-2 py-2 px-3 rounded-xl bg-surface border border-border"
          >
            <Feather name="map-pin" size={16} color={colors.text.secondary} />
            <Text className="text-sm font-semibold text-text-primary flex-1" numberOfLines={1}>
              {selectedLocation?.locationName ?? t('analytics.locationFilterLabel')}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <AnalyticsOfferFilterModal
        visible={filterModalVisible}
        offers={vendorOffers}
        appliedOfferIds={appliedOfferIds}
        onClose={() => setFilterModalVisible(false)}
        onApply={setAppliedOfferIds}
      />

      <AnalyticsLocationFilterModal
        visible={locationModalVisible}
        locations={chainLocations}
        selectedLocationId={selectedLocationId}
        onClose={() => setLocationModalVisible(false)}
        onSelect={onSelectLocation}
      />

      {canChooseLocation && selectedLocation != null && (
        <View
          className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl border border-primary-100"
          style={{ backgroundColor: `${colors.primary.DEFAULT}10` }}
        >
          <Text className="text-sm font-semibold text-primary">
            {selectedLocation.isHeadquarters
              ? t('analytics.statsScopeHeadquarters', { name: selectedLocation.locationName })
              : t('analytics.statsScopeLocation', { name: selectedLocation.locationName })}
          </Text>
        </View>
      )}

      <SectionLabel label={t('analytics.sectionOverview')} />
      {summary == null ? (
        <UnavailableCard />
      ) : (
        <>
          <View className="flex-row gap-2.5 px-3">
            <MetricCard
              label={t('analytics.yourEarnings')}
              value={formatCurrency(summary.totalVendorEarningsCents, currency)}
              sub={
                showBenchmark && periodBenchmark
                  ? benchmarkEarningsSub(periodBenchmark, currency, t)
                  : undefined
              }
              highlight
            />
            <MetricCard
              label={t('analytics.platformFee')}
              value={formatCurrency(summary.totalPlatformFeeCents, currency)}
              destructive
            />
          </View>
          <View className="flex-row gap-2.5 px-3 mt-2.5">
            <MetricCard
              label={t('analytics.grossSales')}
              value={formatCurrency(summary.totalGrossRevenueCents, currency)}
            />
            <MetricCard
              label={t('analytics.unitsSoldListed')}
              value={t('analytics.unitsSoldOfListed', {
                sold: summary.totalUnitsSold,
                listed: summary.totalUnitsListed ?? 0,
              })}
              sub={
                showBenchmark && periodBenchmark
                  ? benchmarkUnitsSub(summary, periodBenchmark, t)
                  : t('analytics.soldOfListedSub')
              }
            />
          </View>
          <View className="flex-row gap-2.5 px-3 mt-2.5">
            <MetricCard
              label={t('analytics.activeOrders')}
              value={String(summary.activeOrderCount)}
              sub={
                showBenchmark && periodBenchmark
                  ? t('analytics.benchmarkUnitsSold', {
                      selected: summary.activeOrderCount,
                      total: periodBenchmark.activeOrderCount,
                    })
                  : undefined
              }
            />
            <MetricCard
              label={t('analytics.sellThroughRate')}
              value={formatSellThroughRate(summary.sellThroughRate)}
              sub={
                showBenchmark && periodBenchmark
                  ? benchmarkStrSub(summary, periodBenchmark, t)
                  : undefined
              }
            />
          </View>
        </>
      )}

      <SectionLabel label={t(strChartTitle(period))} />
      {sellThroughTrend == null ? (
        <UnavailableCard />
      ) : (
        <View style={cardStyle}>
          {strTrend.length === 0 ? (
            <Text className="text-[13px] text-text-secondary text-center py-5">
              {t('analytics.noSellThroughTrendData')}
            </Text>
          ) : (
            <>
              <View className="flex-row gap-4 mb-3">
                <LegendDot color={colors.primary[200]} label={t('analytics.unitsListedLegend')} />
                <LegendDot color={colors.primary.DEFAULT} label={t('analytics.unitsSoldLegend')} />
              </View>
              <View
                style={{
                  height: CHART_BAR_AREA + 24,
                  flexDirection: 'row',
                  gap: strTrend.length > 10 ? 2 : 4,
                }}
              >
                {strTrend.map((point, i) => (
                  <SellThroughTrendColumn
                    key={i}
                    point={point}
                    period={period}
                    locale={i18n.language}
                    maxUnits={maxStrUnits}
                    showLabels={showStrLabels}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      <SectionLabel label={t(revenueChartTitle(period))} />
      {revenueTrend == null ? (
        <UnavailableCard />
      ) : (
        <View style={cardStyle}>
          {trend.length === 0 ? (
            <Text className="text-[13px] text-text-secondary text-center py-5">
              {t('analytics.noTrendData')}
            </Text>
          ) : (
            <View
              style={{
                height: CHART_BAR_AREA + 20,
                flexDirection: 'row',
                gap: trend.length > 10 ? 2 : 4,
              }}
            >
              {trend.map((point, i) => {
                const barH =
                  maxEarnings > 0
                    ? Math.max(
                        Math.round(
                          (point.vendorEarningsCents / maxEarnings) * (CHART_BAR_AREA - 18),
                        ),
                        3,
                      )
                    : 3;
                return (
                  <View key={i} style={{ flex: 1 }}>
                    <View
                      style={{
                        height: CHART_BAR_AREA,
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                      }}
                    >
                      {showRevenueLabels && point.vendorEarningsCents > 0 && (
                        <Text
                          style={{
                            fontSize: 7,
                            color: colors.primary.DEFAULT,
                            marginBottom: 2,
                          }}
                          numberOfLines={1}
                        >
                          {fmtShortCents(point.vendorEarningsCents)}
                        </Text>
                      )}
                      <View
                        style={{
                          width: '100%',
                          height: barH,
                          backgroundColor: colors.primary.DEFAULT,
                          borderRadius: 3,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: trend.length > 10 ? 7 : 9,
                        color: colors.text.secondary,
                        textAlign: 'center',
                        marginTop: 3,
                      }}
                    >
                      {chartAxisLabel(point.date, period, i18n.language)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <SectionLabel label={t('analytics.sectionOffers')} />
      {offerPerformance == null ? (
        <UnavailableCard />
      ) : (
        <View style={[cardStyle, { padding: 0 }]}>
          {allOffers.length === 0 ? (
            <Text className="text-[13px] text-text-secondary text-center p-5">
              {t('analytics.noOffersData')}
            </Text>
          ) : (
            <>
              {visibleOffers.map((offer) => (
                <OfferPerformanceRow key={offer.offerId} offer={offer} currency={currency} t={t} />
              ))}
              {allOffers.length > OFFERS_PREVIEW && (
                <TouchableOpacity
                  onPress={() => setShowAllOffers((v) => !v)}
                  activeOpacity={0.7}
                  className="py-2.5 items-center bg-primary-50"
                >
                  <Text className="text-[13px] font-semibold text-primary">
                    {showAllOffers ? t('analytics.collapseOffers') : t('analytics.showAllOffers')} ›
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      <SectionLabel label={t('analytics.sectionActiveOrders')} />
      {activeOrders == null ? (
        <UnavailableCard />
      ) : (
        <View style={[cardStyle, { padding: 0 }]}>
          {activeOrders.length === 0 ? (
            <Text className="text-[13px] text-text-secondary text-center p-5">
              {t('analytics.noActiveOrders')}
            </Text>
          ) : (
            activeOrders.map((order, idx) => (
              <ActiveOrderRow
                key={order.orderId ?? idx}
                order={order}
                isLast={idx === activeOrders.length - 1}
                t={t}
                locale={i18n.language}
                onPress={
                  order.orderId != null
                    ? () => navigation.navigate('VendorOrderDetail', { orderId: order.orderId as number })
                    : undefined
                }
              />
            ))
          )}
        </View>
      )}

      <SectionLabel label={t('analytics.sectionCompletedOrders')} />
      {completedOrders == null ? (
        <UnavailableCard />
      ) : (
        <View style={[cardStyle, { padding: 0 }]}>
          {completedOrders.length === 0 ? (
            <Text className="text-[13px] text-text-secondary text-center p-5">
              {t('analytics.noCompletedOrders')}
            </Text>
          ) : (
            completedOrders.map((order, idx) => (
              <CompletedOrderRow
                key={order.orderId ?? idx}
                order={order}
                isLast={idx === completedOrders.length - 1}
                t={t}
                locale={i18n.language}
              />
            ))
          )}
        </View>
      )}

      {ratings == null && ratingSummary == null ? (
        <>
          <SectionLabel label={t('analytics.sectionRatings')} />
          <UnavailableCard />
        </>
      ) : avgRating != null ? (
        <>
          <SectionLabel label={t('analytics.sectionRatings')} />
          <View style={cardStyle}>
            <View className="flex-row items-center gap-5">
              <View className="items-center">
                <Text className="text-[40px] font-bold text-text-primary leading-[44px]">
                  {avgRating.toFixed(1)}
                </Text>
                <Text className="text-base text-rating tracking-wide">{starsStr(avgRating)}</Text>
                <Text className="text-[11px] text-text-secondary mt-0.5">
                  {reviewCount} {t('analytics.ratingsLabel')}
                </Text>
              </View>
              {breakdown && (
                <View className="flex-1">
                  {breakdown.map(({ star, pct }) => (
                    <View key={star} className="flex-row items-center gap-1.5 mb-1.5">
                      <Text className="text-[11px] text-text-secondary w-[22px] text-right">
                        {star}★
                      </Text>
                      <View className="flex-1 h-[5px] bg-border rounded-sm overflow-hidden">
                        <View
                          className="h-[5px] bg-rating rounded-sm"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                      <Text className="text-[11px] text-text-secondary w-7 text-right">
                        {pct}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </>
      ) : null}

      <SectionLabel label={t('analytics.sectionPayouts')} />
      {payoutBalance == null ? (
        <UnavailableCard />
      ) : (
        <View style={[cardStyle, { padding: 0, marginBottom: 16 }]}>
          <View className="flex-row items-center justify-between px-3.5 py-3 border-b border-border">
            <Text className="text-sm text-text-secondary">{t('analytics.unsettled')}</Text>
            <Text
              className="text-[15px] font-semibold text-primary"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatCurrency(payoutBalance.unsettledCents, payoutBalance.currency ?? currency)}
            </Text>
          </View>
          {payoutBalance.lastPayoutAt ? (
            <View className="flex-row items-start justify-between px-3.5 py-3">
              <Text className="text-sm text-text-secondary">{t('analytics.lastPayout')}</Text>
              <View className="items-end">
                <Text
                  className="text-[15px] font-semibold text-text-primary"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatCurrency(
                    payoutBalance.lastPayoutAmountCents ?? 0,
                    payoutBalance.currency ?? currency,
                  )}
                </Text>
                <Text className="text-[11px] text-text-secondary mt-0.5">
                  {formatInstant(payoutBalance.lastPayoutAt, i18n.language)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function SellThroughTrendColumn({
  point,
  period,
  locale,
  maxUnits,
  showLabels,
}: {
  point: SellThroughDailyStat;
  period: DashboardPeriod;
  locale: string;
  maxUnits: number;
  showLabels: boolean;
}) {
  const listedH =
    maxUnits > 0
      ? Math.max(Math.round((point.unitsListed / maxUnits) * (CHART_BAR_AREA - 18)), 2)
      : 2;
  const soldH =
    maxUnits > 0
      ? Math.max(Math.round((point.unitsSold / maxUnits) * (CHART_BAR_AREA - 18)), 2)
      : 2;
  const strPct = sellThroughPercent(point.sellThroughRate);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          height: CHART_BAR_AREA,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            gap: 1,
            width: '100%',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              flex: 1,
              height: listedH,
              backgroundColor: colors.primary[200],
              borderRadius: 2,
            }}
          />
          <View
            style={{
              flex: 1,
              height: soldH,
              backgroundColor: colors.primary.DEFAULT,
              borderRadius: 2,
            }}
          />
        </View>
      </View>
      <Text
        style={{
          fontSize: 9,
          color: colors.text.secondary,
          textAlign: 'center',
          marginTop: 3,
        }}
      >
        {chartAxisLabel(point.date, period, locale)}
      </Text>
      {showLabels && strPct != null && (
        <Text
          style={{
            fontSize: 7,
            color: colors.text.secondary,
            textAlign: 'center',
          }}
        >
          {strPct}%
        </Text>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text className="text-[11px] text-text-secondary">{label}</Text>
    </View>
  );
}

function OfferPerformanceRow({
  offer,
  currency,
  t,
}: {
  offer: OfferPerformance;
  currency: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const sellPct = sellThroughPercent(offer.sellThroughRate);
  const unitsListed = offer.unitsListed ?? 0;

  return (
    <View className="px-3.5 py-3 border-b border-border">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5 flex-1">
          <Text className="text-sm font-semibold text-text-primary flex-shrink" numberOfLines={1}>
            {offer.offerName ?? '—'}
          </Text>
          <View
            className="rounded-[10px] px-1.5 py-0.5"
            style={{
              backgroundColor: offer.active ? `${colors.primary.DEFAULT}18` : colors.border,
            }}
          >
            <Text
              className="text-[10px] font-bold"
              style={{ color: offer.active ? colors.primary.DEFAULT : colors.text.secondary }}
            >
              {offer.active ? t('analytics.offerActive') : t('analytics.offerInactive')}
            </Text>
          </View>
        </View>
        <View className="items-end ml-2">
          <Text className="text-[15px] font-bold text-text-primary">
            {formatCurrency(offer.vendorEarningsCents, currency)}
          </Text>
          <Text className="text-[11px] text-text-secondary">
            {t('analytics.unitsSoldOfListed', {
              sold: offer.unitsSold,
              listed: unitsListed,
            })}{' '}
            {t('analytics.units')}
          </Text>
        </View>
      </View>
      {sellPct != null && (
        <View className="flex-row items-center gap-2">
          <View className="flex-1 h-[5px] bg-border rounded-sm overflow-hidden">
            <View className="h-[5px] bg-primary rounded-sm" style={{ width: `${sellPct}%` }} />
          </View>
          <Text className="text-[11px] text-text-secondary w-[110px]">
            {t('analytics.sellThrough')}: {sellPct}%
          </Text>
        </View>
      )}
    </View>
  );
}

function ActiveOrderRow({
  order,
  isLast,
  t,
  locale,
  onPress,
}: {
  order: DashboardActiveOrder;
  isLast: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
  onPress?: () => void;
}) {
  const status = (order.status ?? 'CONFIRMED') as OrderStatus;
  const orderCurrency = order.currency ?? 'RSD';

  return (
    <TouchableOpacity
      className="px-3.5 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }}
      onPress={onPress}
      disabled={onPress == null}
      activeOpacity={onPress != null ? 0.7 : 1}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-text-primary">
          {order.orderId != null
            ? t('analytics.orderNumber', { id: order.orderId })
            : t('analytics.orderNumber', { id: '—' })}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-[15px] font-bold text-text-primary">
            {formatOrderAmount(order.totalPrice, orderCurrency)}
          </Text>
          {onPress != null && (
            <Feather name="chevron-right" size={16} color={colors.text.secondary} />
          )}
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold" style={{ color: orderStatusColor(status) }}>
          {t(orderStatusI18nKey(status))}
        </Text>
        <Text className="text-[11px] text-text-secondary">
          {order.quantity} {t('analytics.units')}
          {order.pickupBy != null ? ` · ${formatPickupDeadline(order.pickupBy, locale)}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function CompletedOrderRow({
  order,
  isLast,
  t,
  locale,
}: {
  order: CompletedOrderSummary;
  isLast: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
}) {
  const orderCurrency = order.currency ?? 'RSD';
  const hasOfferContext =
    (order.offerName != null && order.offerName.length > 0) || order.quantity != null;

  return (
    <View
      className="px-3.5 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-text-primary">
          {order.orderId != null
            ? t('analytics.orderNumber', { id: order.orderId })
            : t('analytics.orderNumber', { id: '—' })}
        </Text>
        <Text className="text-[15px] font-bold text-primary">
          {formatCurrency(order.netAmountCents, orderCurrency)}
        </Text>
      </View>
      {hasOfferContext && (
        <Text className="text-[11px] text-text-secondary mb-1" numberOfLines={1}>
          {order.offerName != null && order.quantity != null
            ? t('analytics.completedOrderOffer', {
                offerName: order.offerName,
                quantity: order.quantity,
                units: t('analytics.units'),
              })
            : order.offerName ?? `${order.quantity ?? 0} ${t('analytics.units')}`}
        </Text>
      )}
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] text-text-secondary flex-1 mr-2" numberOfLines={2}>
          {order.feePercentApplied != null
            ? t('analytics.platformFeePercent', { percent: order.feePercentApplied })
            : t('analytics.platformFee')}
          {' · '}
          {formatCurrency(order.platformFeeCents, orderCurrency)}
        </Text>
        {order.settledAt != null && (
          <Text className="text-[11px] text-text-secondary">
            {formatInstant(order.settledAt, locale)}
          </Text>
        )}
      </View>
    </View>
  );
}

function UnavailableCard({ message }: { message?: string | null }) {
  const { t } = useTranslation();
  return (
    <View style={cardStyle}>
      <Text className="text-sm text-text-secondary text-center py-4">
        {message != null && message.length > 0 ? message : t('analytics.sectionUnavailable')}
      </Text>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wide mt-5 mb-1.5 mx-4">
      {label}
    </Text>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
  destructive,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  destructive?: boolean;
}) {
  const valueColor = destructive
    ? colors.error
    : highlight
      ? colors.primary.DEFAULT
      : colors.text.primary;

  return (
    <View className="flex-1 bg-surface rounded-[14px] p-3.5" style={cardShadow}>
      <Text className="text-xs text-text-secondary font-medium mb-1.5">{label}</Text>
      <Text className="text-[22px] font-bold" style={{ color: valueColor }}>
        {value}
      </Text>
      {sub != null && (
        <Text className="text-[11px] text-text-secondary mt-1">{sub}</Text>
      )}
    </View>
  );
}
