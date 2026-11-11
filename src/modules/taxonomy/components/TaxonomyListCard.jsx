import { Edit2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * TaxonomyListCard — Left column catalog card displaying existing brands
 * or categories along with product association counts and edit/delete actions.
 */
export default function TaxonomyListCard({
  items,
  productCounts,
  editingItem,
  isDeleting,
  config,
  onEditClick,
  onDeleteClick,
}) {
  const { catalogTitle, singularLower, pluralLower, emptyCatalogText, editTooltip, deleteTooltip } = config;

  return (
    <Card className="p-6 border-border space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">{catalogTitle}</h3>
        <Badge variant="secondary" className="text-xs font-semibold">
          {items.length} {items.length === 1 ? singularLower : pluralLower}
        </Badge>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground italic text-xs">
          {emptyCatalogText}
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item) => {
            const count = productCounts[item.id] || 0;
            const isSelected = editingItem?.id === item.id;

            return (
              <div
                key={item.id}
                onClick={() => onEditClick(item)}
                className={`flex items-center justify-between p-3.5 rounded-lg border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-primary/10 border-primary/50 text-primary ring-1 ring-primary/20'
                    : 'bg-card border-border hover:bg-accent/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {isSelected && (
                      <Badge variant="default" className="text-[9px] uppercase px-1 py-0 h-4">
                        Editing
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {count} {count === 1 ? 'product' : 'products'} associated
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditClick(item);
                    }}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title={editTooltip}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(item);
                    }}
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title={deleteTooltip}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

