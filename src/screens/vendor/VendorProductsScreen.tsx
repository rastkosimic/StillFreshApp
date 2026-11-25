import { Feather } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '@/components/BackButton';
import ProductNameModal from '@/components/ProductNameModal';
import { MAX_VENDOR_PRODUCTS } from '@/config/offerItems';
import { useVendorProducts } from '@/hooks/useVendorProducts';
import { VendorStackScreenProps } from '@/navigation/types';
import { isMissingProductError } from '@/services/vendorProductService';
import { colors } from '@/theme/colors';
import { VendorProduct } from '@/types';
import { isSameItemName } from '@/utils/offerItems';
import { vendorProductErrorKey } from '@/utils/vendorProductErrors';

type Props = VendorStackScreenProps<'VendorProducts'>;

export default function VendorProductsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    products,
    isLoading,
    hasLoaded,
    loadFailed,
    refresh,
    addProduct,
    renameProduct,
    removeProduct,
  } = useVendorProducts();

  // The product being renamed, or null when adding. Kept after the sheet closes so its
  // title does not flip while it slides away.
  const [editing, setEditing] = useState<VendorProduct | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyProductId, setBusyProductId] = useState<number | null>(null);

  const isListFull = products.length >= MAX_VENDOR_PRODUCTS;

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const openEditor = (product: VendorProduct | null) => {
    setEditorError(null);
    setEditing(product);
    setIsEditorOpen(true);
  };

  const onSubmitName = async (name: string) => {
    if (editing != null && editing.name === name) {
      setIsEditorOpen(false);
      return;
    }
    if (products.some((p) => p.id !== editing?.id && isSameItemName(p.name, name))) {
      setEditorError(t('vendor.products.errorDuplicate'));
      return;
    }

    setIsSaving(true);
    try {
      if (editing == null) {
        await addProduct(name);
      } else {
        await renameProduct(editing.id, name);
      }
      setIsEditorOpen(false);
    } catch (error) {
      setEditorError(t(vendorProductErrorKey(error)));
      // The list on screen is evidently out of date (taken name, deleted product, full list).
      void refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (product: VendorProduct) => {
    Alert.alert(
      t('vendor.products.deleteTitle', { name: product.name }),
      t('vendor.products.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => void runDelete(product),
        },
      ],
    );
  };

  const runDelete = async (product: VendorProduct) => {
    setBusyProductId(product.id);
    try {
      await removeProduct(product.id);
    } catch (error) {
      if (isMissingProductError(error)) {
        // Already deleted by someone else at this location, which is what was asked for.
        await refresh();
      } else {
        Alert.alert(t('common.error'), t(vendorProductErrorKey(error)));
      }
    } finally {
      setBusyProductId(null);
    }
  };

  const header = (
    <View
      className="bg-background border-b border-border px-5 pb-3.5 flex-row items-center gap-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text className="text-[17px] font-semibold text-primary flex-1">
        {t('vendor.products.title')}
      </Text>
    </View>
  );

  if (!hasLoaded) {
    return (
      <View className="flex-1 bg-background">
        {header}
        <View className="flex-1 items-center justify-center px-10">
          {isLoading || !loadFailed ? (
            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
          ) : (
            <>
              <Feather name="wifi-off" size={44} color={colors.primary[200]} />
              <Text className="text-base font-semibold text-text-primary text-center mt-4">
                {t('vendor.products.loadFailedTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => void refresh()}
                activeOpacity={0.8}
                className="bg-primary rounded-xl py-3 px-6 mt-5"
              >
                <Text className="text-white font-semibold text-base">{t('common.retry')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {header}

      <FlatList
        data={products}
        keyExtractor={(product) => String(product.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary.DEFAULT}
          />
        }
        ListHeaderComponent={
          <View className="px-5 pt-4 pb-2">
            <Text className="text-[13px] leading-[18px] text-text-secondary">
              {t('vendor.products.intro')}
            </Text>
            {products.length > 0 && (
              <View className="flex-row items-baseline justify-between mt-4">
                <Text className="text-xs text-text-secondary font-semibold uppercase tracking-wide">
                  {t('vendor.products.listLabel')}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {products.length}/{MAX_VENDOR_PRODUCTS}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-10 py-10">
            <Feather name="list" size={48} color={colors.primary[200]} />
            <Text className="text-base font-semibold text-text-primary text-center mt-4">
              {t('vendor.products.emptyTitle')}
            </Text>
            <Text className="text-sm text-text-secondary text-center mt-1 leading-5">
              {t('vendor.products.emptyDesc')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View
            className={`bg-surface flex-row items-center gap-1 pl-4 pr-2 py-1.5 border-border ${
              index === 0 ? 'border-t' : ''
            } border-b`}
          >
            <Text className="flex-1 text-[15px] text-text-primary py-2" numberOfLines={2}>
              {item.name}
            </Text>
            {busyProductId === item.id ? (
              <View className="w-20 h-10 items-center justify-center">
                <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => openEditor(item)}
                  activeOpacity={0.7}
                  hitSlop={4}
                  className="w-10 h-10 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={t('vendor.products.renameA11y', { name: item.name })}
                >
                  <Feather name="edit-2" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(item)}
                  activeOpacity={0.7}
                  hitSlop={4}
                  className="w-10 h-10 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={t('vendor.products.deleteA11y', { name: item.name })}
                >
                  <Feather name="trash-2" size={18} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      />

      <View
        className="bg-background border-t border-border px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={() => openEditor(null)}
          disabled={isListFull}
          activeOpacity={0.8}
          className={`rounded-xl py-4 items-center flex-row justify-center gap-2 ${
            isListFull ? 'bg-border' : 'bg-primary'
          }`}
        >
          <Feather
            name="plus"
            size={18}
            color={isListFull ? colors.text.secondary : colors.text.inverse}
          />
          <Text
            className={`font-semibold text-base ${
              isListFull ? 'text-text-secondary' : 'text-white'
            }`}
          >
            {t('vendor.products.add')}
          </Text>
        </TouchableOpacity>
        {isListFull && (
          <Text className="text-xs text-text-secondary text-center mt-2">
            {t('vendor.products.limitReached', { max: MAX_VENDOR_PRODUCTS })}
          </Text>
        )}
      </View>

      <ProductNameModal
        visible={isEditorOpen}
        title={editing != null ? t('vendor.products.renameTitle') : t('vendor.products.add')}
        initialName={editing?.name ?? ''}
        submitLabel={editing != null ? t('common.save') : t('vendor.products.addCta')}
        isSaving={isSaving}
        errorMessage={editorError}
        hint={editing != null ? t('vendor.products.renameHint') : undefined}
        onNameEdited={() => setEditorError(null)}
        onClose={() => setIsEditorOpen(false)}
        onSubmit={(name) => void onSubmitName(name)}
      />
    </View>
  );
}
