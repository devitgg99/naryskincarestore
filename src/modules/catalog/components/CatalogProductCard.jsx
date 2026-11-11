import { Eye, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/**
 * CatalogProductCard — Customer showcase grid card showing photo, brand pill,
 * category, Khmer/English names, retail price, and quick-view action.
 */
export default function CatalogProductCard({
  product,
  sellingPrice,
  brandName,
  categoryName,
  onSelectProduct,
}) {
  return (
    <Card className="group overflow-hidden rounded-2xl border border-border bg-card hover:border-[#000080]/50 hover:shadow-lg hover:shadow-black/5 transition-all duration-200 flex flex-col justify-between">
      {/* Image Container with Zoom effect */}
      <div
        onClick={() => onSelectProduct(product)}
        className="relative w-full aspect-square bg-muted/60 overflow-hidden cursor-pointer flex items-center justify-center border-b border-border/60"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name_en || product.name_kh}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4">
            <ImageIcon className="w-10 h-10 opacity-30" />
            <span className="text-[10px] uppercase font-semibold tracking-wider">No Image</span>
          </div>
        )}

        {brandName && (
          <div className="absolute top-2.5 left-2.5">
            <Badge className="bg-[#000080]/90 text-white hover:bg-[#000080] border-none text-[10px] font-bold px-2 py-0.5 shadow-sm">
              {brandName}
            </Badge>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct(product);
          }}
          className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-card/90 text-foreground border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-card"
          title="Quick Preview"
        >
          <Eye className="w-4 h-4 text-[#000080] dark:text-blue-400" />
        </button>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {categoryName && (
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              {categoryName}
            </span>
          )}

          <h3
            onClick={() => onSelectProduct(product)}
            className="font-bold text-sm sm:text-base text-foreground leading-snug cursor-pointer group-hover:text-[#000080] dark:group-hover:text-blue-400 transition-colors line-clamp-2"
          >
            {product.name_kh}
          </h3>

          <p className="text-xs text-muted-foreground font-medium line-clamp-1">
            {product.name_en}
          </p>
        </div>

        <div className="pt-2 border-t border-border/60 flex items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Selling Price
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#000080] dark:text-blue-400 leading-tight">
              ${sellingPrice.toFixed(2)}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectProduct(product)}
            className="h-8 px-2.5 text-xs font-semibold border-border hover:bg-muted text-foreground gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}

