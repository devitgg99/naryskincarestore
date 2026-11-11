import { useState, useMemo } from 'react';
import { db } from '../../services/db';
import { Card } from '@/components/ui/card';
import TaxonomyListCard from './components/TaxonomyListCard';
import TaxonomyFormCard from './components/TaxonomyFormCard';
import QuickEditProductDialog from './components/QuickEditProductDialog';

/**
 * TaxonomyManager — Shared CRUD + bulk-association manager for Brands and Categories.
 */
export default function TaxonomyManager({
  items = [],
  brands = [],
  categories = [],
  products = [],
  config,
  onRefresh,
  showToast,
}) {
  const {
    Icon,
    headerTitle,
    headerSubtitle,
    field,
    secondaryField,
    deleteConfirm,
    saveValidationWarning,
    saveSuccessToast,
    saveErrorFallback,
    deleteSuccessToast,
    deleteErrorPrefix,
    onSaveEntity,
    onDeleteEntity,
    onAssociateProducts,
  } = config;

  const [editingItem, setEditingItem] = useState(null); // null when creating
  const [itemName, setItemName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterValue, setFilterValue] = useState('all'); // 'all', 'none', 'current', or specific ID

  // Quick edit product states
  const [quickEditingProduct, setQuickEditingProduct] = useState(null);
  const [quickEditNameKh, setQuickEditNameKh] = useState('');
  const [quickEditNameEn, setQuickEditNameEn] = useState('');
  const [quickEditBasePrice, setQuickEditBasePrice] = useState('');
  const [quickEditBrandId, setQuickEditBrandId] = useState('');
  const [quickEditCategoryId, setQuickEditCategoryId] = useState('');
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);

  const primaryMap = useMemo(() => {
    const map = {};
    items.forEach((item) => { map[item.id] = item.name; });
    return map;
  }, [items]);

  const secondaryItems = secondaryField === 'brand_id' ? brands : categories;
  const secondaryMap = useMemo(() => {
    const map = {};
    secondaryItems.forEach((item) => { map[item.id] = item.name; });
    return map;
  }, [secondaryItems]);

  const productCounts = useMemo(() => {
    const counts = {};
    items.forEach((item) => { counts[item.id] = 0; });
    products.forEach((p) => {
      if (p[field] && counts[p[field]] !== undefined) {
        counts[p[field]]++;
      }
    });
    return counts;
  }, [items, products, field]);

  const handleEditClick = (item) => {
    setEditingItem(item);
    setItemName(item.name);
    const associatedIds = products
      .filter((p) => p[field] === item.id)
      .map((p) => p.id);
    setSelectedProductIds(associatedIds);
    setProductSearch('');
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setItemName('');
    setSelectedProductIds([]);
    setProductSearch('');
  };

  const handleProductToggle = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAllFiltered = (filteredProds) => {
    const filteredIds = filteredProds.map((p) => p.id);
    const allSelected = filteredIds.every((id) => selectedProductIds.includes(id));

    if (allSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => {
        const toAdd = filteredIds.filter((id) => !prev.includes(id));
        return [...prev, ...toAdd];
      });
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(deleteConfirm(item))) return;
    setIsDeleting(true);
    try {
      await onDeleteEntity(item.id);
      showToast(deleteSuccessToast, 'success');
      if (editingItem?.id === item.id) {
        handleCancelEdit();
      }
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast(deleteErrorPrefix + e.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) {
      showToast(saveValidationWarning, 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const entityToSave = { name: itemName.trim() };
      if (editingItem) {
        entityToSave.id = editingItem.id;
      }
      const savedEntity = await onSaveEntity(entityToSave);
      await onAssociateProducts(savedEntity.id, selectedProductIds);

      showToast(saveSuccessToast, 'success');
      setItemName('');
      setSelectedProductIds([]);
      setEditingItem(null);
      setProductSearch('');
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast(e.message || saveErrorFallback, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickEditProduct = (product) => {
    setQuickEditingProduct(product);
    setQuickEditNameKh(product.name_kh || '');
    setQuickEditNameEn(product.name_en || '');
    setQuickEditBasePrice(product.base_price || '0.00');
    setQuickEditBrandId(product.brand_id || '');
    setQuickEditCategoryId(product.category_id || '');
  };

  const handleSaveQuickEdit = async (e) => {
    e.preventDefault();
    if (!quickEditNameKh.trim() || !quickEditNameEn.trim()) {
      showToast('Please enter both Khmer and English product names.', 'warning');
      return;
    }

    setIsSavingQuickEdit(true);
    try {
      await db.saveProduct({
        ...quickEditingProduct,
        name_kh: quickEditNameKh.trim(),
        name_en: quickEditNameEn.trim(),
        base_price: Number(quickEditBasePrice) || 0,
        brand_id: quickEditBrandId || null,
        category_id: quickEditCategoryId || null,
      });
      showToast('Product updated successfully!', 'success');
      setQuickEditingProduct(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast('Failed to save product details: ' + err.message, 'error');
    } finally {
      setIsSavingQuickEdit(false);
    }
  };

  const sortedFilteredProducts = useMemo(() => {
    const queryLower = productSearch.toLowerCase();
    const filtered = products.filter((p) => {
      const matchesSearch =
        (p.name_en && p.name_en.toLowerCase().includes(queryLower)) ||
        (p.name_kh && p.name_kh.includes(productSearch));

      if (!matchesSearch) return false;

      if (filterValue === 'none') return !p[field];
      if (filterValue === 'current') return Boolean(editingItem && p[field] === editingItem.id);
      if (filterValue !== 'all') return p[field] === filterValue;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aChecked = selectedProductIds.includes(a.id);
      const bChecked = selectedProductIds.includes(b.id);
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [products, productSearch, filterValue, field, editingItem, selectedProductIds]);

  const allFilteredSelected =
    sortedFilteredProducts.length > 0 &&
    sortedFilteredProducts.every((p) => selectedProductIds.includes(p.id));

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60 backdrop-blur-md border-border shadow-xs">
        <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
          <Icon className="w-5 h-5 text-primary" />
          {headerTitle}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{headerSubtitle}</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <TaxonomyListCard
            items={items}
            productCounts={productCounts}
            editingItem={editingItem}
            isDeleting={isDeleting}
            config={config}
            onEditClick={handleEditClick}
            onDeleteClick={handleDelete}
          />
        </div>

        <div className="lg:col-span-7 space-y-4">
          <TaxonomyFormCard
            config={config}
            items={items}
            editingItem={editingItem}
            itemName={itemName}
            onItemNameChange={setItemName}
            filterValue={filterValue}
            onFilterValueChange={setFilterValue}
            productSearch={productSearch}
            onProductSearchChange={setProductSearch}
            sortedFilteredProducts={sortedFilteredProducts}
            selectedProductIds={selectedProductIds}
            allFilteredSelected={allFilteredSelected}
            primaryMap={primaryMap}
            secondaryMap={secondaryMap}
            isSaving={isSaving}
            onSubmit={handleSave}
            onCancelEdit={handleCancelEdit}
            onToggleProduct={handleProductToggle}
            onSelectAllFiltered={handleSelectAllFiltered}
            onQuickEditProduct={handleQuickEditProduct}
          />
        </div>
      </div>

      <QuickEditProductDialog
        open={!!quickEditingProduct}
        onClose={() => setQuickEditingProduct(null)}
        nameKh={quickEditNameKh}
        onNameKhChange={setQuickEditNameKh}
        nameEn={quickEditNameEn}
        onNameEnChange={setQuickEditNameEn}
        basePrice={quickEditBasePrice}
        onBasePriceChange={setQuickEditBasePrice}
        brandId={quickEditBrandId}
        onBrandIdChange={setQuickEditBrandId}
        brands={brands}
        categoryId={quickEditCategoryId}
        onCategoryIdChange={setQuickEditCategoryId}
        categories={categories}
        isSaving={isSavingQuickEdit}
        onSubmit={handleSaveQuickEdit}
      />
    </div>
  );
}

