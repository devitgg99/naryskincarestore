import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * CustomerFormDialog — Modal form for creating or editing a customer record.
 */
export default function CustomerFormDialog({
  open,
  onOpenChange,
  isEditing,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  mapUrl,
  onMapUrlChange,
  locationNote,
  onLocationNoteChange,
  isSaving,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Customer Name (Khmer or English) *
              </label>
              <Input
                type="text"
                required
                placeholder="E.g. Zeii Pov Store, Sokha Grocery"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <Input
                type="text"
                placeholder="E.g. 012 345 678"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Google Maps GPS Link
              </label>
              <Input
                type="url"
                placeholder="https://maps.google.com/?q=..."
                value={mapUrl}
                onChange={(e) => onMapUrlChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Location Notes / Landmarks
              </label>
              <textarea
                placeholder="E.g. opposite Orussey Market, Blue House Gate..."
                value={locationNote}
                onChange={(e) => onLocationNoteChange(e.target.value)}
                rows="3"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isEditing ? 'Update Customer' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

