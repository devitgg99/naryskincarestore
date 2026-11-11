/**
 * Returns the effective selling price for a product.
 * Prefers explicit manual selling_price; otherwise uses max supplier cost + $0.20,
 * falling back to product.base_price + $0.20.
 */
export function getEffectiveSellingPrice(product, highestPrice) {
  if (product?.selling_price && Number(product.selling_price) > 0) {
    return Number(product.selling_price);
  }
  return highestPrice ? highestPrice.price + 0.20 : Number(product?.base_price || 0) + 0.20;
}

