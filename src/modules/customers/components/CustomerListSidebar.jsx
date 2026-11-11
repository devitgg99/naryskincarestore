import { Search, Phone, Edit, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * CustomerListSidebar — Searchable left sidebar list of customers with
 * order counts and quick edit/delete buttons.
 */
export default function CustomerListSidebar({
  searchTerm,
  onSearchChange,
  filteredCustomers,
  activeCustomerId,
  orderCountByCustomer,
  onSelectCustomer,
  onEditCustomer,
  onDeleteCustomer,
}) {
  return (
    <div className="lg:col-span-5 space-y-4 flex flex-col h-[calc(100vh-270px)]">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search customers by name or phone..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-1">
        {filteredCustomers.map((customer) => {
          const count = orderCountByCustomer[customer.id] || 0;
          const isSelected = activeCustomerId === customer.id;

          return (
            <Card
              key={customer.id}
              onClick={() => onSelectCustomer(customer.id)}
              className={`p-4 border transition-all duration-150 cursor-pointer relative group flex items-start justify-between shadow-xs ${
                isSelected
                  ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/20'
                  : 'hover:bg-accent/50 border-border'
              }`}
            >
              <div className="space-y-1 flex-1">
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base">
                  {customer.name}
                </h4>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {customer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {customer.phone}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0">
                    {count} orders
                  </Badge>
                </div>
              </div>

              <div className="flex gap-1.5 opacity-90 hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCustomer(customer);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Edit Customer"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCustomer(customer.id);
                  }}
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete Customer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}

        {filteredCustomers.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground italic text-xs border-dashed">
            No customers found.
          </Card>
        )}
      </div>
    </div>
  );
}

