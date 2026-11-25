import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import ProductNameModal from '@/components/ProductNameModal';
import { MAX_VENDOR_PRODUCTS, OFFER_ITEM_LIMITS } from '@/config/offerItems';
import { useVendorProducts } from '@/hooks/useVendorProducts';
import { isDuplicateProductError } from '@/services/vendorProductService';
import { colors } from '@/theme/colors';
import { OfferItem, VendorProduct } from '@/types';
import { isSameItemName, syncItemNamesWithProducts } from '@/utils/offerItems';
import { vendorProductErrorKey } from '@/utils/vendorProductErrors';

/** Product chips shown before the vendor asks for the whole list. */
const COLLAPSED_PRODUCT_COUNT = 12;

interface OfferItemsEditorProps {
  items: OfferItem[];
  onChange: (items: OfferItem[]) => void;
  /** Opens the "My products" screen, where names are renamed and deleted. */
  onManageProducts: () => void;
}

/**
 * Optional "what's in the bag" section of the offer form. The vendor picks from their own
 * product list or types a new name; nothing is suggested, and leaving it empty is a normal
 * surprise bag, so this section never blocks saving the offer.
 */
export default function OfferItemsEditor({
  items,
  onChange,
  onManageProducts,
}: OfferItemsEditorProps) {
  const { t } = useTranslation();
  const { products, isLoading, hasLoaded, loadFailed, refresh, addProduct } =
    useVendorProducts();

  const [showAllProducts, setShowAllProducts] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saveToList, setSaveToList] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // A product renamed since the offer was saved shows (and is saved) under its current name.
  useEffect(() => {
    if (!hasLoaded) return;
    const synced = syncItemNamesWithProducts(items, products);
    if (synced !== items) onChange(synced);
  }, [hasLoaded, products, items, onChange]);

  const isFull = items.length >= OFFER_ITEM_LIMITS.maxItems;
  const isProductListFull = products.length >= MAX_VENDOR_PRODUCTS;

  // By id, or by name for a line that was typed by hand or whose product was deleted and
  // later added again: either way the bag already lists this product.
  const indexOfProduct = (product: VendorProduct): number =>
    items.findIndex(
      (item) => item.productId === product.id || isSameItemName(item.name, product.name),
    );

  const toggleProduct = (product: VendorProduct) => {
    const index = indexOfProduct(product);
    if (index >= 0) {
      onChange(items.filter((_, i) => i !== index));
      return;
    }
    if (isFull) return;
    onChange([...items, { productId: product.id, name: product.name }]);
  };

  const changeQuantity = (index: number, delta: 1 | -1) => {
    const next = (items[index].quantity ?? 0) + delta;
    if (next > OFFER_ITEM_LIMITS.maxQuantity) return;
    // Stepping below 1 goes back to "no quantity given", not to zero pieces.
    onChange(
      items.map((item, i) => (i === index ? { ...item, quantity: next < 1 ? null : next } : item)),
    );
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const openAdd = () => {
    setAddError(null);
    setSaveToList(!isProductListFull);
    setIsAddOpen(true);
  };

  const submitNewName = async (name: string) => {
    if (items.some((item) => isSameItemName(item.name, name))) {
      setIsAddOpen(false);
      return;
    }

    const existing = products.find((p) => isSameItemName(p.name, name));
    if (existing) {
      onChange([...items, { productId: existing.id, name: existing.name }]);
      setIsAddOpen(false);
      return;
    }

    if (!saveToList || isProductListFull) {
      onChange([...items, { name }]);
      setIsAddOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const created = await addProduct(name);
      onChange([...items, { productId: created.id, name: created.name }]);
      setIsAddOpen(false);
    } catch (error) {
      if (isDuplicateProductError(error)) {
        // Someone at this location added the same name in the meantime: the bag still gets
        // the line, and the refreshed list shows the product as picked.
        onChange([...items, { name }]);
        setIsAddOpen(false);
      } else {
        setAddError(t(vendorProductErrorKey(error)));
      }
      void refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const visibleProducts =
    showAllProducts || products.length <= COLLAPSED_PRODUCT_COUNT
      ? products
      : products.slice(0, COLLAPSED_PRODUCT_COUNT);

  return (
    <View
      className="mx-4 bg-surface rounded-[14px] p-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Text className="text-[13px] leading-[18px] text-text-secondary">
        {t('vendor.offer.contentsHint')}
      </Text>

      {items.length > 0 && (
        <View className="mt-3">
          <View className="flex-row items-baseline justify-between mb-1">
            <Text className="text-xs font-semibold text-text-secondary">
              {t('vendor.offer.contentsInThisBag')}
            </Text>
            <Text className={`text-xs ${isFull ? 'text-error' : 'text-text-secondary'}`}>
              {items.length}/{OFFER_ITEM_LIMITS.maxItems}
            </Text>
          </View>

          {items.map((item, index) => (
            <View
              key={`${index}-${item.name}`}
              className={`flex-row items-center gap-2 py-2 ${
                index < items.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <Text className="flex-1 text-[15px] text-text-primary" numberOfLines={2}>
                {item.name}
              </Text>

              <View className="flex-row items-center">
                <StepperButton
                  icon="minus"
                  disabled={item.quantity == null}
                  accessibilityLabel={t('vendor.offer.contentsQuantityLess', { name: item.name })}
                  onPress={() => changeQuantity(index, -1)}
                />
                <Text
                  className={`w-8 text-center text-[15px] ${
                    item.quantity == null
                      ? 'text-text-secondary'
                      : 'font-semibold text-text-primary'
                  }`}
                >
                  {item.quantity ?? '–'}
                </Text>
                <StepperButton
                  icon="plus"
                  disabled={(item.quantity ?? 0) >= OFFER_ITEM_LIMITS.maxQuantity}
                  accessibilityLabel={t('vendor.offer.contentsQuantityMore', { name: item.name })}
                  onPress={() => changeQuantity(index, 1)}
                />
              </View>

              <TouchableOpacity
                onPress={() => removeItem(index)}
                activeOpacity={0.7}
                hitSlop={8}
                className="w-8 h-8 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={t('vendor.offer.contentsRemove', { name: item.name })}
              >
                <Feather name="x" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          <Text className="text-xs text-text-secondary leading-4 mt-1">
            {isFull
              ? t('vendor.offer.contentsLimit', { max: OFFER_ITEM_LIMITS.maxItems })
              : t('vendor.offer.contentsQuantityHint')}
          </Text>
        </View>
      )}

      <View className="mt-4">
        <Text className="text-xs font-semibold text-text-secondary mb-2">
          {t('vendor.offer.contentsMyProducts')}
        </Text>

        {!hasLoaded && isLoading ? (
          <View className="py-2 items-start">
            <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
          </View>
        ) : !hasLoaded && loadFailed ? (
          <View className="flex-row items-center flex-wrap gap-x-2">
            <Text className="text-[13px] text-text-secondary">
              {t('vendor.offer.contentsLoadFailed')}
            </Text>
            <TouchableOpacity onPress={() => void refresh()} activeOpacity={0.7} hitSlop={8}>
              <Text className="text-[13px] font-semibold text-primary">{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <Text className="text-[13px] leading-[18px] text-text-secondary">
            {t('vendor.offer.contentsNoProducts')}
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {visibleProducts.map((product) => {
              const isSelected = indexOfProduct(product) >= 0;
              const isDisabled = !isSelected && isFull;
              return (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => toggleProduct(product)}
                  disabled={isDisabled}
                  activeOpacity={0.8}
                  hitSlop={4}
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border ${
                    isSelected ? 'bg-primary border-primary' : 'bg-surface border-border'
                  } ${isDisabled ? 'opacity-50' : ''}`}
                  style={{ maxWidth: '100%' }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                >
                  {isSelected && <Feather name="check" size={14} color={colors.text.inverse} />}
                  <Text
                    className={`text-sm font-medium shrink ${
                      isSelected ? 'text-white' : 'text-text-primary'
                    }`}
                    numberOfLines={1}
                  >
                    {product.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {products.length > COLLAPSED_PRODUCT_COUNT && (
          <TouchableOpacity
            onPress={() => setShowAllProducts((current) => !current)}
            activeOpacity={0.7}
            hitSlop={8}
            className="self-start mt-2.5"
          >
            <Text className="text-[13px] font-semibold text-primary">
              {showAllProducts
                ? t('vendor.offer.contentsShowFewer')
                : t('vendor.offer.contentsShowAll', { count: products.length })}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row items-center justify-between flex-wrap gap-x-3 gap-y-2 mt-4 pt-3 border-t border-border">
        <TouchableOpacity
          onPress={openAdd}
          disabled={isFull}
          activeOpacity={0.8}
          hitSlop={6}
          className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 bg-primary-50 ${
            isFull ? 'opacity-50' : ''
          }`}
        >
          <Feather name="plus" size={16} color={colors.primary.DEFAULT} />
          <Text className="text-sm font-semibold text-primary">
            {t('vendor.offer.contentsAddNew')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onManageProducts}
          activeOpacity={0.7}
          hitSlop={8}
          className="flex-row items-center gap-1 py-2"
        >
          <Text className="text-[13px] font-semibold text-text-secondary">
            {t('vendor.offer.contentsManage')}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ProductNameModal
        visible={isAddOpen}
        title={t('vendor.offer.contentsAddNew')}
        initialName=""
        submitLabel={t('vendor.offer.contentsAddCta')}
        isSaving={isSaving}
        errorMessage={addError}
        saveToList={{
          value: saveToList,
          onChange: setSaveToList,
          unavailableHint: isProductListFull
            ? t('vendor.offer.contentsListFull', { max: MAX_VENDOR_PRODUCTS })
            : null,
        }}
        onNameEdited={() => setAddError(null)}
        onClose={() => setIsAddOpen(false)}
        onSubmit={(name) => void submitNewName(name)}
      />
    </View>
  );
}

function StepperButton({
  icon,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  icon: 'plus' | 'minus';
  disabled: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={6}
      className={`w-8 h-8 rounded-full border border-border items-center justify-center ${
        disabled ? 'opacity-40' : ''
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={16} color={colors.text.primary} />
    </TouchableOpacity>
  );
}
