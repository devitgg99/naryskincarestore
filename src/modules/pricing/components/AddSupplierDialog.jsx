import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * AddSupplierDialog — Modal form to create a new supplier profile.
 */
export default function AddSupplierDialog({
  open,
  onOpenChange,
  supplierName,
  onSupplierNameChange,
  supplierPhone,
  onSupplierPhoneChange,
  isSaving,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>Create a new supplier profile in the system.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supplier Name *</label>
              <Input
                type="text"
                required
                placeholder="E.g. Keo Pich Trading"
                value={supplierName}
                onChange={(e) => onSupplierNameChange(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact Phone</label>
              <Input
                type="text"
                placeholder="E.g. 012 345 678"
                value={supplierPhone}
                onChange={(e) => onSupplierPhoneChange(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
            >
              {isSaving ? 'Adding...' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

