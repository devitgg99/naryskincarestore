import { AlertTriangle, ImageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * LowStockAlertsCard — Grid of low-stock product/supplier pairs with
 * one-click +12 / +24 quick restock actions.
 */
export default function LowStockAlertsCard({
  lowStockItems,
  productMap,
  supplierMap,
  onQuickRestock,
}) {
  if (!lowStockItems.length) return null;

  return (
    <Card className="bg-destructive/5 border-destructive/20 p-6 space-y-4 shadow-xs">
      <div className="flex items-center gap-2 text-destructive font-bold text-sm sm:text-base">
        <AlertTriangle className="w-4.5 h-4.5" />
        <h3>Low Stock Warnings ({lowStockItems.length} items)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lowStockItems.map((sp) => {
          const prod = productMap[sp.product_id];
          const sup = supplierMap[sp.supplier_id];
          if (!prod || !sup) return null;

          return (
            <Card
              key={sp.id}
              className="bg-card/80 border-destructive/20 p-3.5 flex justify-between items-center shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted border border-border">
                  {prod.image_url ? (
                    <img src={prod.image_url} alt={prod.name_en} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground text-xs block">{prod.name_kh}</span>
                  <span className="text-[11px] text-muted-foreground block truncate max-w-[130px]">{prod.name_en}</span>
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 mt-1">
                    {sup.name}: {sp.stock_qty} {sp.stock_unit}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  onClick={() => onQuickRestock(sp, 12)}
                  className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-500 font-bold"
                >
                  +12 ({sp.stock_unit === 'pcs' ? 'pcs' : sp.stock_unit})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickRestock(sp, 24)}
                  className="h-6 text-[10px] px-2 font-bold"
                >
                  +24
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

