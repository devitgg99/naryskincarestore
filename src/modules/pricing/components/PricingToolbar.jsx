import { Search, SlidersHorizontal, Info, Plus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

/**
 * PricingToolbar — Header card (add actions + helper tip) and filter toolbar
 * (search, brand, category, supplier filters, and Matrix/Cards view toggle).
 */
export default function PricingToolbar({
  searchTerm,
  onSearchChange,
  selectedBrandFilter,
  onBrandFilterChange,
  brands,
  selectedCategoryFilter,
  onCategoryFilterChange,
  categories,
  selectedSupplierFilter,
  onSupplierFilterChange,
  suppliers,
  viewLayoutMode,
  onViewLayoutModeChange,
  onOpenAddProduct,
  onOpenAddSupplier,
}) {
  return (
    <>
      {/* Header Panel */}
      <Card className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card/60 backdrop-blur-md p-6 border-border shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-wide">Product + Supplier Pricing Table</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Compare prices across all suppliers and manage stock levels side-by-side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={onOpenAddProduct}
            className="gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
          <Button
            variant="outline"
            onClick={onOpenAddSupplier}
            className="gap-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3.5 py-2 rounded-xl border border-border">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <span>Click any supplier cell in the table to edit pricing and stock levels.</span>
          </div>
        </div>
      </Card>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by English or Khmer product name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 h-9 text-xs bg-background/50 border-input"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />

          <select
            value={selectedBrandFilter}
            onChange={(e) => onBrandFilterChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[150px]"
          >
            <option value="all">All Brands</option>
            <option value="none">No Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[150px]"
          >
            <option value="all">All Categories</option>
            <option value="none">No Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedSupplierFilter}
            onChange={(e) => onSupplierFilterChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[180px]"
          >
            <option value="all">All Suppliers (Show Grid)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>Only {s.name}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
            <Button
              type="button"
              variant={viewLayoutMode === 'matrix' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewLayoutModeChange('matrix')}
              className="h-7 px-2.5 text-xs font-semibold gap-1.5"
              title="Matrix Table View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Matrix View</span>
            </Button>
            <Button
              type="button"
              variant={viewLayoutMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewLayoutModeChange('cards')}
              className="h-7 px-2.5 text-xs font-semibold gap-1.5"
              title="Mobile Card List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mobile Cards</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

