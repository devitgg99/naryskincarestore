import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Sparkles, LogOut, Sun, Moon, Filter, X, ShoppingBag, Send } from 'lucide-react';
import { telegramHaptic, setTelegramBackButton } from '../services/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import CatalogProductCard from './catalog/components/CatalogProductCard';
import ProductDetailDialog from './catalog/components/ProductDetailDialog';

export default function UserProductCatalog({
  products = [],
  brands = [],
  categories = [],
  prices = [],
  currentUser,
  onLogout,
  theme,
  toggleTheme,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-asc' | 'price-desc' | 'name-asc'
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);

  // Sync Telegram native BackButton with product modal state
  useEffect(() => {
    if (selectedProductDetails) {
      telegramHaptic('light');
      setTelegramBackButton(true, () => {
        setSelectedProductDetails(null);
      });
    } else {
      setTelegramBackButton(false);
    }
    return () => {
      setTelegramBackButton(false);
    };
  }, [selectedProductDetails]);

  const brandMap = useMemo(() => {
    const map = {};
    brands.forEach((b) => { map[b.id] = b.name; });
    return map;
  }, [brands]);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const getProductSellingPrice = useCallback((product) => {
    if (product.selling_price && Number(product.selling_price) > 0) {
      return Number(product.selling_price);
    }
    const prodPrices = prices.filter((p) => p.product_id === product.id && p.price > 0);
    if (prodPrices.length > 0) {
      const maxSp = Math.max(...prodPrices.map((p) => Number(p.price)));
      return maxSp + 0.20;
    }
    return (Number(product.base_price) || 0) + 0.20;
  }, [prices]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase().trim();
          const matchKh = (product.name_kh || '').toLowerCase().includes(query);
          const matchEn = (product.name_en || '').toLowerCase().includes(query);
          const matchBarcode = (product.barcode || '').toLowerCase().includes(query);
          if (!matchKh && !matchEn && !matchBarcode) return false;
        }

        if (selectedBrand !== 'all') {
          if (selectedBrand === 'none') {
            if (product.brand_id) return false;
          } else if (product.brand_id !== selectedBrand) {
            return false;
          }
        }

        if (selectedCategory !== 'all') {
          if (selectedCategory === 'none') {
            if (product.category_id) return false;
          } else if (product.category_id !== selectedCategory) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = getProductSellingPrice(a);
        const priceB = getProductSellingPrice(b);

        if (sortBy === 'price-asc') return priceA - priceB;
        if (sortBy === 'price-desc') return priceB - priceA;
        if (sortBy === 'name-asc') return (a.name_en || '').localeCompare(b.name_en || '');
        return 0;
      });
  }, [products, searchTerm, selectedBrand, selectedCategory, sortBy, getProductSellingPrice]);

  const hasActiveFilters = selectedBrand !== 'all' || selectedCategory !== 'all' || searchTerm.trim() !== '';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* User Header Navigation */}
      <header className="sticky top-0 z-40 h-16 border-b border-border bg-card/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#000080] flex items-center justify-center font-black text-white shadow-xs text-sm tracking-tight">
            WP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-wider text-foreground leading-tight">
                WHOLESALE
              </h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-semibold">
                Customer Catalog
              </Badge>
            </div>
            <p className="text-[10px] font-bold text-[#000080] dark:text-blue-400 tracking-widest uppercase">
              Product Showcase
            </p>
          </div>
        </div>

        {/* User Account & Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#000080]" />}
          </Button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                currentUser?.isTelegram
                  ? 'bg-[#0088cc] text-white'
                  : 'bg-[#000080]/10 text-[#000080] dark:text-blue-400'
              }`}
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-left">
              <span className="text-xs font-semibold text-foreground block leading-tight">
                {currentUser?.name || 'Customer'}
              </span>
              {currentUser?.isTelegram ? (
                <span className="text-[9px] text-[#0088cc] flex items-center gap-0.5 leading-none font-semibold">
                  <Send className="w-2.5 h-2.5" /> Telegram
                </span>
              ) : (
                <span className="text-[9px] text-muted-foreground block leading-none font-medium">
                  Browsing Mode
                </span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-9 gap-1.5 text-xs font-semibold border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Catalog Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome & Search Banner */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-card via-muted/30 to-card border border-border shadow-xs relative overflow-hidden">
          <div className="max-w-2xl space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#000080]/10 text-[#000080] dark:text-blue-400 text-xs font-semibold border border-[#000080]/20 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Wholesale Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Browse Our Products & Selling Prices
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Explore authentic skincare and beauty supplies with current retail prices. Search by Khmer or English product names.
            </p>

            <div className="pt-3">
              <div className="relative max-w-lg">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search products by name in Khmer, English or Barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-9 h-11 bg-background text-sm rounded-xl border-border focus:border-[#000080] shadow-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-card rounded-xl border border-border shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="h-8.5 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#000080]"
            >
              <option value="all">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value="none">Unbranded</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8.5 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#000080]"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="none">Uncategorized</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8.5 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#000080]"
            >
              <option value="default">Sort: Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBrand('all');
                  setSelectedCategory('all');
                  setSearchTerm('');
                  setSortBy('default');
                }}
                className="h-8.5 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                <X className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-medium self-end md:self-auto">
            Showing <strong className="text-foreground">{filteredProducts.length}</strong> of {products.length} products
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No Products Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              We couldn't find any products matching your current search or filter criteria. Try clearing filters or searching another keyword.
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedBrand('all');
                  setSelectedCategory('all');
                  setSearchTerm('');
                }}
                className="mt-4 text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProducts.map((product) => (
              <CatalogProductCard
                key={product.id}
                product={product}
                sellingPrice={getProductSellingPrice(product)}
                brandName={product.brand_id ? brandMap[product.brand_id] : null}
                categoryName={product.category_id ? categoryMap[product.category_id] : null}
                onSelectProduct={setSelectedProductDetails}
              />
            ))}
          </div>
        )}
      </main>

      <ProductDetailDialog
        product={selectedProductDetails}
        sellingPrice={selectedProductDetails ? getProductSellingPrice(selectedProductDetails) : 0}
        brandName={selectedProductDetails?.brand_id ? brandMap[selectedProductDetails.brand_id] : null}
        categoryName={selectedProductDetails?.category_id ? categoryMap[selectedProductDetails.category_id] : null}
        onClose={() => setSelectedProductDetails(null)}
      />

      <footer className="w-full py-4 px-6 text-center text-xs text-muted-foreground border-t border-border mt-auto">
        © 2026 Wholesale Portal System • Customer Product Showcase
      </footer>
    </div>
  );
}
