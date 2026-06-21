import React, { useState, useEffect } from 'react';
import { Search, Plus, MapPin, Phone, Calendar, ShoppingBag, Edit, Trash2, X, ChevronRight, TrendingUp } from 'lucide-react';
import { db } from '../services/db';

export default function CustomerDirectory({ customers, orders, orderItems, products, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  
  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null); // null means adding new
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Set default customer selected
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

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

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!name) return;

    setIsSaving(true);
    try {
      const payload = {
        name,
        phone,
        map_url: mapUrl,
        location_note: locationNote
      };
      if (editingCustomer) {
        payload.id = editingCustomer.id;
      }
      const saved = await db.saveCustomer(payload);
      onRefresh();
      setSelectedCustomerId(saved.id);
      setIsFormOpen(false);
    } catch (err) {
      alert("Error saving customer: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (window.confirm("Are you sure you want to delete this customer? All their order history will be deleted as well.")) {
      try {
        await db.deleteCustomer(id);
        onRefresh();
        setSelectedCustomerId(null);
      } catch (err) {
        alert("Error deleting customer: " + err.message);
      }
    }
  };

  // Get order item details for history list
  const getOrderSummaryText = (orderId) => {
    const items = orderItems.filter(oi => oi.order_id === orderId);
    return items.map(oi => {
      const prod = products.find(p => p.id === oi.product_id);
      const name = prod ? prod.name_kh : 'Product';
      return `${name} (x${oi.quantity})`;
    }).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/30 p-6 rounded-2xl border border-dark-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Customer Directory</h2>
          <p className="text-xs text-dark-400 mt-1">
            Manage customer records, map coordinates, and review purchase statistics.
          </p>
        </div>
        <button 
          onClick={() => handleOpenForm(null)}
          className="glass-button-primary"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Directory List (5 cols) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col h-[calc(100vh-270px)]">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="Search customers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 glass-input"
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-1">
            {filteredCustomers.map(customer => {
              const count = orders.filter(o => o.customer_id === customer.id).length;
              const isSelected = activeCustomer && customer.id === activeCustomer.id;

              return (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer relative group flex items-start justify-between ${
                    isSelected 
                      ? 'bg-primary-500/10 border-primary-500/40 shadow-md shadow-primary-500/5' 
                      : 'bg-dark-900/30 border-dark-800/80 hover:bg-dark-900/60'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold text-white group-hover:text-primary-400 transition-colors text-sm sm:text-base">
                      {customer.name}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-dark-400">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-dark-500" />
                          {customer.phone}
                        </span>
                      )}
                      <span className="bg-dark-800 text-dark-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {count} orders
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenForm(customer); }}
                      className="p-1 rounded bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white"
                      title="Edit Customer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                      className="p-1 rounded bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-900/20"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <div className="p-8 text-center text-dark-500 italic">
                No customers found.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Profile & Invoices history (7 cols) */}
        <div className="lg:col-span-7">
          {activeCustomer ? (
            <div className="glass-panel rounded-2xl border border-dark-800 p-6 space-y-6 h-[calc(100vh-270px)] overflow-y-auto scrollbar-thin">
              {/* Profile Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-dark-800/80">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg text-lg">
                      {activeCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{activeCustomer.name}</h3>
                      <p className="text-xs text-dark-400">Created: {new Date(activeCustomer.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  {activeCustomer.location_note && (
                    <div className="flex items-start gap-2 text-sm text-dark-300 bg-dark-950/40 p-3 rounded-xl border border-dark-850">
                      <MapPin className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                      <span>{activeCustomer.location_note}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {activeCustomer.map_url ? (
                    <a
                      href={activeCustomer.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-button-primary py-2 px-3 flex items-center gap-1.5"
                    >
                      <MapPin className="w-4 h-4" />
                      Google Maps
                    </a>
                  ) : (
                    <span className="text-[10px] text-dark-500 italic border border-dashed border-dark-800 p-2 rounded-xl">
                      No GPS location added
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Block */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-950/40 p-4 rounded-xl border border-dark-850 text-center">
                  <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider block">Total Spent</span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-400 block mt-1">${totalSpent.toFixed(2)}</span>
                </div>
                <div className="bg-dark-950/40 p-4 rounded-xl border border-dark-850 text-center">
                  <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider block">Orders</span>
                  <span className="text-lg sm:text-2xl font-black text-primary-400 block mt-1">{customerOrders.length}</span>
                </div>
                <div className="bg-dark-950/40 p-4 rounded-xl border border-dark-850 text-center">
                  <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider block">Avg. Invoice</span>
                  <span className="text-lg sm:text-2xl font-black text-violet-400 block mt-1">${avgOrderValue.toFixed(2)}</span>
                </div>
              </div>

              {/* Invoices History list */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary-400" />
                  Invoice History
                </h4>

                <div className="space-y-2">
                  {customerOrders.map(order => (
                    <div 
                      key={order.id}
                      className="p-4 rounded-xl border border-dark-850 bg-dark-900/20 hover:bg-dark-900/50 transition-colors flex justify-between items-center group/order"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-dark-400 bg-dark-800 px-1.5 py-0.5 rounded font-mono">
                            ID: {order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            order.status === 'paid' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-900/30'
                              : order.status === 'delivered'
                              ? 'bg-primary-500/10 text-primary-400 border border-primary-900/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-900/30'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-dark-300 font-medium truncate max-w-sm">
                          {getOrderSummaryText(order.id)}
                        </p>
                        <div className="text-[10px] text-dark-500 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.ordered_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-white">${Number(order.total_amount).toFixed(2)}</span>
                        {Number(order.delivery_fee) > 0 && (
                          <div className="text-[9px] text-dark-500">+$${Number(order.delivery_fee).toFixed(2)} delivery</div>
                        )}
                      </div>
                    </div>
                  ))}

                  {customerOrders.length === 0 && (
                    <div className="p-6 text-center text-dark-500 italic text-xs">
                      No purchase records for this customer yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-dark-800 p-12 text-center text-dark-500 italic h-full flex flex-col justify-center items-center">
              Please select or create a customer to view their details.
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handleSaveCustomer}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-150"
          >
            <div className="p-6 border-b border-dark-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Customer Name (Khmer or English) *</label>
                <input 
                  type="text" 
                  required
                  placeholder="E.g. Zeii Pov Store, Sokha Grocery"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Contact Phone</label>
                <input 
                  type="text" 
                  placeholder="E.g. 012 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Google Maps GPS Link</label>
                <input 
                  type="url" 
                  placeholder="https://maps.google.com/?q=..."
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Location Notes / Landmarks</label>
                <textarea 
                  placeholder="E.g. opposite Orussey Market, Blue House Gate..."
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  rows="3"
                  className="w-full glass-input resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-dark-800 bg-dark-950/20">
              <button 
                type="button" 
                onClick={() => setIsFormOpen(false)} 
                className="glass-button-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSaving}
                className="glass-button-primary"
              >
                {editingCustomer ? 'Update Customer' : 'Create Customer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
