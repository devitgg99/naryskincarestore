/**
 * Returns true if a product matches the selected brand and category dropdown filters.
 */
export function matchesBrandAndCategoryFilter(product, selectedBrandFilter, selectedCategoryFilter) {
  if (!product) return false;

  if (selectedBrandFilter !== 'all') {
    if (selectedBrandFilter === 'none') {
      if (product.brand_id) return false;
    } else if (product.brand_id !== selectedBrandFilter) {
      return false;
    }
  }

  if (selectedCategoryFilter !== 'all') {
    if (selectedCategoryFilter === 'none') {
      if (product.category_id) return false;
    } else if (product.category_id !== selectedCategoryFilter) {
      return false;
    }
  }

  return true;
}

