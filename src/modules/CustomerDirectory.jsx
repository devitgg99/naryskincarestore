import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { db } from '../services/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CustomerListSidebar from './customers/components/CustomerListSidebar';
import CustomerProfileCard from './customers/components/CustomerProfileCard';
import CustomerFormDialog from './customers/components/CustomerFormDialog';

export default function CustomerDirectory({ customers, orders, orderItems, products, onRefresh, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(() => {
    const autoOpen = localStorage.getItem('wsp_auto_open_add_customer');
    if (autoOpen === 'true') {
      localStorage.removeItem('wsp_auto_open_add_customer');
      return true;
    }
    return false;
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || (customers.length > 0 ? customers[0] : null),
    [customers, selectedCustomerId]
  );

  const orderCountByCustomer = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      if (o.customer_id) {
        counts[o.customer_id] = (counts[o.customer_id] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[String(p.id).trim()] = p; });
    return map;
  }, [products]);

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

  const filteredCustomers = useMemo(() => {
    const queryLower = searchTerm.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(queryLower) || (c.phone && c.phone.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  const customerOrders = orders.filter((o) => o.customer_id === (activeCustomer?.id || ''));
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
      showToast('Customer saved successfully!', 'success');
      onRefresh();
      setSelectedCustomerId(saved.id);
      setIsFormOpen(false);
    } catch (err) {
      showToast('Error saving customer: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (confirm('Are you sure you want to delete this customer? All their order history will be deleted as well.')) {
      try {
        await db.deleteCustomer(id);
        showToast('Customer deleted successfully.', 'success');
        onRefresh();
        setSelectedCustomerId(null);
      } catch (err) {
        showToast('Error deleting customer: ' + err.message, 'error');
      }
    }
  };

  const getOrderSummaryText = (order) => {
    const orderId = typeof order === 'object' ? order.id : order;
    const embedded = typeof order === 'object' ? (order.order_items || order.items) : null;
    const items = (Array.isArray(embedded) && embedded.length > 0)
      ? embedded
      : orderItems.filter(
          (oi) => String(oi.order_id || oi.orderId || '').trim().toLowerCase() === String(orderId).trim().toLowerCase()
        );

    if (items.length === 0) return 'No items recorded';

    return items
      .map((oi) => {
        const prod = productMap[String(oi.product_id).trim()];
        const prodName = prod ? prod.name_kh : (oi.custom_name || 'Product');
        return `${prodName} (x${oi.quantity})`;
      })
      .join(', ');
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
        <Button onClick={() => handleOpenForm(null)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <CustomerListSidebar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filteredCustomers={filteredCustomers}
          activeCustomerId={activeCustomer?.id || null}
          orderCountByCustomer={orderCountByCustomer}
          onSelectCustomer={setSelectedCustomerId}
          onEditCustomer={handleOpenForm}
          onDeleteCustomer={handleDeleteCustomer}
        />

        <CustomerProfileCard
          activeCustomer={activeCustomer}
          customerOrders={customerOrders}
          totalSpent={totalSpent}
          avgOrderValue={avgOrderValue}
          getOrderSummaryText={getOrderSummaryText}
          onEditCustomer={handleOpenForm}
          onDeleteCustomer={handleDeleteCustomer}
        />
      </div>

      <CustomerFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        isEditing={!!editingCustomer}
        name={name}
        onNameChange={setName}
        phone={phone}
        onPhoneChange={setPhone}
        mapUrl={mapUrl}
        onMapUrlChange={setMapUrl}
        locationNote={locationNote}
        onLocationNoteChange={setLocationNote}
        isSaving={isSaving}
        onSubmit={handleSaveCustomer}
      />
    </div>
  );
}
