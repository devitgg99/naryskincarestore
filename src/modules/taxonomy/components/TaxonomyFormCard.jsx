import { Search, Edit2, CheckSquare, Square, X, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * TaxonomyFormCard — Right column form card for creating/editing a taxonomy
 * entity (brand or category) and bulk-assigning products to it.
 */
export default function TaxonomyFormCard({
  config,
  items,
  editingItem,
  itemName,
  onItemNameChange,
  filterValue,
  onFilterValueChange,
  productSearch,
  onProductSearchChange,
  sortedFilteredProducts,
  selectedProductIds,
  allFilteredSelected,
  primaryMap,
  secondaryMap,
  isSaving,
  onSubmit,
  onCancelEdit,
  onToggleProduct,
  onSelectAllFiltered,
  onQuickEditProduct,
}) {
  const {
    Icon,
    singular,
    namePlaceholder,
    field,
    secondaryField,
    saveEditLabel,
    createLabel,
  } = config;

  return (
    <Card
      className={`p-6 border transition-all shadow-xs space-y-5 ${
        editingItem
          ? 'border-primary/50 shadow-md shadow-primary/5 bg-card'
          : 'border-border'
      }`}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {editingItem ? `Edit ${singular}: ${editingItem.name}` : `Create New ${singular}`}
          </h3>
          {editingItem && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              className="text-xs h-7 gap-1"
            >
              <X className="w-3 h-3" />
              Cancel Edit
            </Button>
          )}
        </div>

        {/* Entity Name Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {singular} Name
          </label>
          <Input
            type="text"
            placeholder={namePlaceholder}
            value={itemName}
            onChange={(e) => onItemNameChange(e.target.value)}
            required
          />
        </div>

        {/* Bulk Product Assignment Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Bulk Product Assignment ({selectedProductIds.length} selected)
            </label>

            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">View:</span>
              <select
                value={filterValue}
                onChange={(e) => onFilterValueChange(e.target.value)}
                className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Products</option>
                <option value="none">No {singular} Assigned</option>
                {editingItem && <option value="current">Assigned to this {singular}</option>}
                {items
                  .filter((item) => !editingItem || item.id !== editingItem.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>Assigned to {item.name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Filter and Select-all Controls */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter products..."
                value={productSearch}
                onChange={(e) => onProductSearchChange(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectAllFiltered(sortedFilteredProducts)}
              className="text-xs h-8 whitespace-nowrap gap-1.5"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  Deselect Filtered
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Select Filtered ({sortedFilteredProducts.length})
                </>
              )}
            </Button>
          </div>

          {/* Products Checkbox List */}
          <div className="border border-border rounded-lg max-h-[35vh] overflow-y-auto p-2 space-y-1.5 bg-muted/20 scrollbar-thin">
            {sortedFilteredProducts.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground italic text-xs">
                No products match your filter.
              </div>
            ) : (
              sortedFilteredProducts.map((p) => {
                const isChecked = selectedProductIds.includes(p.id);
                const currentPrimaryName = p[field] ? primaryMap[p[field]] : null;
                const currentSecondaryName = p[secondaryField] ? secondaryMap[p[secondaryField]] : null;

                return (
                  <div
                    key={p.id}
                    onClick={() => onToggleProduct(p.id)}
                    className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-primary/10 border-primary/40 text-foreground'
                        : 'bg-card border-border hover:bg-accent/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <div className="truncate">
                        <span className="font-semibold text-foreground mr-1.5">{p.name_kh}</span>
                        <span className="text-muted-foreground text-[11px]">({p.name_en})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {currentSecondaryName && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {currentSecondaryName}
                        </Badge>
                      )}

                      {currentPrimaryName && currentPrimaryName !== editingItem?.name && (
                        <Badge variant="secondary" className="text-[10px]">
                          {currentPrimaryName}
                        </Badge>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickEditProduct(p);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Quick edit product info"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {editingItem && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : (editingItem ? saveEditLabel : createLabel)}
          </Button>
        </div>
      </form>
    </Card>
  );
}

