import { Layers } from 'lucide-react';
import { db } from '../services/db';
import TaxonomyManager from './taxonomy/TaxonomyManager';

const CATEGORY_CONFIG = {
  Icon: Layers,
  headerTitle: 'Category Management',
  headerSubtitle: 'Categorize products by cosmetic categories (lotion, cream, mask) and manage assignments.',
  catalogTitle: 'Categories Catalog',
  singular: 'Category',
  singularLower: 'category',
  pluralLower: 'categories',
  emptyCatalogText: 'No categories created yet. Create one on the right to start.',
  editTooltip: 'Edit category & products',
  deleteTooltip: 'Delete Category',
  namePlaceholder: 'e.g. Cleanser, Toner, Serum, Mask...',
  field: 'category_id',
  secondaryField: 'brand_id',
  saveEditLabel: 'Save Category & Associations',
  createLabel: 'Create Category',
  deleteConfirm: (category) =>
    `Are you sure you want to delete the category "${category.name}"? Products under this category will not be deleted, but they will be dissociated.`,
  saveValidationWarning: 'Please enter a category name.',
  saveSuccessToast: 'Category saved and products associated successfully!',
  saveErrorFallback: 'Failed to save category details.',
  deleteSuccessToast: 'Category deleted successfully.',
  deleteErrorPrefix: 'Failed to delete category: ',
  onSaveEntity: (category) => db.saveCategory(category),
  onDeleteEntity: (id) => db.deleteCategory(id),
  onAssociateProducts: (categoryId, productIds) => db.associateProductsWithCategory(categoryId, productIds),
};

export default function CategoryManager({ categories, brands, products, onRefresh, showToast }) {
  return (
    <TaxonomyManager
      items={categories}
      brands={brands}
      categories={categories}
      products={products}
      config={CATEGORY_CONFIG}
      onRefresh={onRefresh}
      showToast={showToast}
    />
  );
}
