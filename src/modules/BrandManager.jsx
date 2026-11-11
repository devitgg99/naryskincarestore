import { Tag } from 'lucide-react';
import { db } from '../services/db';
import TaxonomyManager from './taxonomy/TaxonomyManager';

const BRAND_CONFIG = {
  Icon: Tag,
  headerTitle: 'Brand Management',
  headerSubtitle: 'Categorize products by brand and manage associations in bulk.',
  catalogTitle: 'Brands Catalog',
  singular: 'Brand',
  singularLower: 'brand',
  pluralLower: 'brands',
  emptyCatalogText: 'No brands created yet. Create one on the right to start.',
  editTooltip: 'Edit brand & products',
  deleteTooltip: 'Delete Brand',
  namePlaceholder: 'e.g. EL, Yasaka, Kiss...',
  field: 'brand_id',
  secondaryField: 'category_id',
  saveEditLabel: 'Save Brand & Associations',
  createLabel: 'Create Brand',
  deleteConfirm: (brand) =>
    `Are you sure you want to delete the brand "${brand.name}"? Products under this brand will not be deleted, but they will be dissociated.`,
  saveValidationWarning: 'Please enter a brand name.',
  saveSuccessToast: 'Brand saved and products associated successfully!',
  saveErrorFallback: 'Failed to save brand details.',
  deleteSuccessToast: 'Brand deleted successfully.',
  deleteErrorPrefix: 'Failed to delete brand: ',
  onSaveEntity: (brand) => db.saveBrand(brand),
  onDeleteEntity: (id) => db.deleteBrand(id),
  onAssociateProducts: (brandId, productIds) => db.associateProductsWithBrand(brandId, productIds),
};

export default function BrandManager({ brands, categories = [], products, onRefresh, showToast }) {
  return (
    <TaxonomyManager
      items={brands}
      brands={brands}
      categories={categories}
      products={products}
      config={BRAND_CONFIG}
      onRefresh={onRefresh}
      showToast={showToast}
    />
  );
}
