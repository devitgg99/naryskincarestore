import { useState, useEffect } from 'react';
import { Search, Plus, MapPin, Phone, Calendar, ShoppingBag, Edit, Trash2 } from 'lucide-react';
import { db } from '../services/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function CustomerDirectory({ customers, orders, orderItems, products, onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  
  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(() => {
    const autoOpen = localStorage.getItem('wsp_auto_open_add_customer');
    if (autoOpen === 'true') {
      localStorage.removeItem('wsp_auto_open_add_customer');
      return true;
    }
    return false;
  });
  const [editingCustomer, setEditingCustomer] = useState(null); // null means adding new
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Set default customer selected
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (customers.length > 0 && selectedCustomerId === null) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleOpenForm = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone || '');
      setMapUrl(customer.map_url || '');
      setLocationNote(customer.location_note || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setMapUrl('');
      setLocationNote('');
    }
    setIsFormOpen(true);
  };

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || (customers.length > 0 ? customers[0] : null);

  // Filter customers
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  // Customer orders and stats
  const customerOrders = orders.filter(o => o.customer_id === (activeCustomer?.id || ''));
  const totalSpent = customerOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const avgOrderValue = customerOrders.length > 0 ? totalSpent / customerOrders.length : 0;

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { name, phone, map_url: mapUrl, location_note: locationNote };
      if (editingCustomer) {
        payload.id = editingCustomer.id;
      }
      const saved = await db.saveCustomer(payload);
      showToast("Customer saved successfully!", "success");
      onRefresh();
      setSelectedCustomerId(saved.id);
      setIsFormOpen(false);
    } catch (err) {
      showToast("Error saving customer: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (confirm("Are you sure you want to delete this customer? All their order history will be deleted as well.")) {
      try {
        await db.deleteCustomer(id);
        showToast("Customer deleted successfully.", "success");
        onRefresh();
        setSelectedCustomerId(null);
      } catch (err) {
        showToast("Error deleting customer: " + err.message, "error");
      }
    }
  };

  // Get order item details for history list
  const getOrderSummaryText = (orderId) => {
    const items = orderItems.filter(oi => oi.order_id === orderId);
    return items.map(oi => {
      const prod = products.find(p => p.id === oi.product_id);
      const prodName = prod ? prod.name_kh : 'Product';
      return `${prodName} (x${oi.quantity})`;
    }).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 bg-card/60 backdrop-blur-md border-border shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-wide">Customer Directory</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage customer records, map coordinates, and review purchase statistics.
          </p>
        </div>
        <Button 
          onClick={() => handleOpenForm(null)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Directory List (5 cols) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col h-[calc(100vh-270px)]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search customers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-1">
            {filteredCustomers.map(customer => {
              const count = orders.filter(o => o.customer_id === customer.id).length;
              const isSelected = activeCustomer && customer.id === activeCustomer.id;

              return (
                <Card
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
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
                      onClick={(e) => { e.stopPropagation(); handleOpenForm(customer); }}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Edit Customer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
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

        {/* Right Side: Profile & Invoices history (7 cols) */}
        <div className="lg:col-span-7">
          {activeCustomer ? (
            <Card className="border-border p-6 space-y-6 h-[calc(100vh-270px)] overflow-y-auto scrollbar-thin shadow-xs">
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center font-bold text-white shadow-md text-lg">
                      {activeCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{activeCustomer.name}</h3>
                      <p className="text-xs text-muted-foreground">Created: {new Date(activeCustomer.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  {activeCustomer.location_note && (
                    <div className="flex items-start gap-2 text-sm text-foreground/80 bg-muted/40 p-3 rounded-xl border border-border">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{activeCustomer.location_note}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeCustomer.map_url ? (
                    <a
                      href={activeCustomer.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="default" className="gap-1.5 h-8 text-xs">
                        <MapPin className="w-3.5 h-3.5" />
                        Google Maps
                      </Button>
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic border border-dashed border-border px-2.5 py-1 rounded-lg flex items-center">
                      No GPS location added
                    </span>
                  )}
                  
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenForm(activeCustomer)}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Edit className="w-3.5 h-3.5 text-primary" />
                    Edit Info
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteCustomer(activeCustomer.id)}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Stats Block */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/30 p-4 text-center border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Total Spent</span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-400 block mt-1 font-mono">${totalSpent.toFixed(2)}</span>
                </Card>
                <Card className="bg-muted/30 p-4 text-center border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Orders</span>
                  <span className="text-lg sm:text-2xl font-black text-primary block mt-1 font-mono">{customerOrders.length}</span>
                </Card>
                <Card className="bg-muted/30 p-4 text-center border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Avg. Invoice</span>
                  <span className="text-lg sm:text-2xl font-black text-violet-400 block mt-1 font-mono">${avgOrderValue.toFixed(2)}</span>
                </Card>
              </div>

              {/* Invoices History list */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  Invoice History
                </h4>

                <div className="space-y-2">
                  {customerOrders.map(order => (
                    <Card 
                      key={order.id}
                      className="p-3.5 border-border bg-card/60 hover:bg-accent/40 transition-colors flex justify-between items-center shadow-2xs"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            ID: {order.id.slice(-6).toUpperCase()}
                          </span>
                          <Badge 
                            variant={order.status === 'paid' ? 'success' : order.status === 'delivered' ? 'default' : 'warning'}
                            className="text-[9px] uppercase px-1.5 py-0"
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground/80 font-medium truncate max-w-sm">
                          {getOrderSummaryText(order.id)}
                        </p>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.ordered_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground font-mono">${Number(order.total_amount).toFixed(2)}</span>
                        {Number(order.delivery_fee) > 0 && (
                          <div className="text-[9px] text-muted-foreground">+$${Number(order.delivery_fee).toFixed(2)} delivery</div>
                        )}
                      </div>
                    </Card>
                  ))}

                  {customerOrders.length === 0 && (
                    <Card className="p-6 text-center text-muted-foreground italic text-xs border-dashed">
                      No purchase records for this customer yet.
                    </Card>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-border border-dashed p-12 text-center text-muted-foreground italic h-full flex flex-col justify-center items-center">
              Please select or create a customer to view their details.
            </Card>
          )}
        </div>
      </div>

      {/* Customer Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </DialogTitle>
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
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setPhone(e.target.value)}
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
                  onChange={(e) => setMapUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Location Notes / Landmarks
                </label>
                <textarea 
                  placeholder="E.g. opposite Orussey Market, Blue House Gate..."
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  rows="3"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border">
              <Button 
                type="button" 
                variant="ghost"
                onClick={() => setIsFormOpen(false)} 
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
              >
                {editingCustomer ? 'Update Customer' : 'Create Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
