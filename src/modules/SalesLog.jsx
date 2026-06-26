import { useState } from 'react';
import { Search, Calendar, Filter, Eye, Printer, Trash2 } from 'lucide-react';
import { db } from '../services/db';

export default function SalesLog({ orders, customers, orderItems, products, prices, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD
  const [activeOrderPreview, setActiveOrderPreview] = useState(null); // Order details to view

  // Helper to retrieve the cost of an item at order-time with cascade lookup fallbacks
  const getItemCost = (oi) => {
    if (oi.supplier_price) return Number(oi.supplier_price);
    
    // Fallback: look up in the supplier_prices table if a supplier is linked
    if (oi.supplier_id && prices) {
      const match = prices.find(sp => sp.product_id === oi.product_id && sp.supplier_id === oi.supplier_id);
      if (match) return match.price;
    }
    
    // Fallback: use cheapest supplier price for this product
    if (prices) {
      const productPrices = prices.filter(sp => sp.product_id === oi.product_id);
      if (productPrices.length > 0) {
        return Math.min(...productPrices.map(sp => sp.price));
      }
    }
    
    // Last fallback: use product base price
    const prod = products.find(p => p.id === oi.product_id);
    return prod ? prod.base_price : 0;
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const cust = customers.find(c => c.id === order.customer_id);
    const customerName = cust ? cust.name.toLowerCase() : '';
    const matchesSearch = customerName.includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    let matchesDate = true;
    if (dateFilter) {
      const orderDate = new Date(order.ordered_at).toISOString().slice(0, 10);
      matchesDate = orderDate === dateFilter;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await db.updateOrderStatus(orderId, newStatus);
      onRefresh();
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to delete this order? This action cannot be undone and will restore stock deductions (if in mock mode).")) {
      try {
        await db.deleteOrder(orderId);
        onRefresh();
      } catch (err) {
        alert("Error deleting order: " + err.message);
      }
    }
  };

  const getOrderItemsSummary = (orderId) => {
    const items = orderItems.filter(oi => oi.order_id === orderId);
    return items.map(oi => {
      const prod = products.find(p => p.id === oi.product_id);
      return `${prod ? prod.name_kh : 'Product'} (x${oi.quantity})`;
    }).join(', ');
  };

  const handleOpenPreview = (order) => {
    const items = orderItems.filter(oi => oi.order_id === order.id);
    const customer = customers.find(c => c.id === order.customer_id);
    setActiveOrderPreview({ order, items, customer });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/40 p-6 rounded-2xl border border-dark-800/40 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Sales Log</h2>
            <p className="text-xs text-dark-400 mt-1">
              Browse full sales records, update delivery and payment statuses, and review invoices.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="Filter by customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 glass-input"
            />
          </div>
          <div className="relative">
            <Calendar className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-11 glass-input text-dark-300"
            />
          </div>
          <div className="relative">
            <Filter className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-11 glass-input"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        {/* Sales Log Table */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl border border-dark-800">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-dark-950/60 border-b border-dark-800/80 text-dark-300 font-semibold">
                  <th className="p-4">Invoice ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Order Date</th>
                  <th className="p-4 min-w-[200px]">Items Purchased</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-right text-emerald-405 text-emerald-400 font-bold">Profit</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-850">
                {filteredOrders.map(order => {
                  const cust = customers.find(c => c.id === order.customer_id);
                  const itemsSummary = getOrderItemsSummary(order.id);
                  
                  const currentItems = orderItems.filter(oi => oi.order_id === order.id);
                  const orderProfit = currentItems.reduce((sum, oi) => {
                    const cost = getItemCost(oi);
                    const selling = Number(oi.unit_price);
                    const qty = Number(oi.quantity);
                    return sum + (selling - cost) * qty;
                  }, 0);

                  return (
                    <tr key={order.id} className="hover:bg-dark-900/30 transition-colors">
                      {/* ID */}
                      <td className="p-4 font-mono font-bold text-xs text-primary-400">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      
                      {/* Customer */}
                      <td className="p-4 font-semibold text-white">
                        {cust ? cust.name : 'Unknown Customer'}
                      </td>
                      
                      {/* Date */}
                      <td className="p-4 text-dark-300">
                        {new Date(order.ordered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      
                      {/* Items */}
                      <td className="p-4 text-xs text-dark-400 max-w-sm truncate" title={itemsSummary}>
                        {itemsSummary || 'No items'}
                      </td>
                      
                      {/* Price */}
                      <td className="p-4 text-right font-bold text-white">
                        ${Number(order.total_amount).toFixed(2)}
                      </td>
                      
                      {/* Profit */}
                      <td className="p-4 text-right font-bold text-emerald-400">
                        ${orderProfit.toFixed(2)}
                      </td>
                      
                      {/* Status interactive selector */}
                      <td className="p-4 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase outline-none cursor-pointer border ${
                            order.status === 'paid' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-900/30'
                              : order.status === 'delivered'
                              ? 'bg-primary-500/10 text-primary-400 border-primary-900/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-900/30'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="delivered">Delivered</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenPreview(order)}
                            className="p-1.5 rounded bg-dark-900 hover:bg-dark-800 text-dark-300 hover:text-white"
                            title="View Invoice Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-1.5 rounded bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-900/20"
                            title="Delete / Cancel Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-dark-500 italic">
                      No orders logged matching your search filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Details Overlay Modal (Zeii Pov Format) */}
      {activeOrderPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center no-print">
          <div className="bg-dark-900 border border-dark-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header controls */}
            <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-950/40">
              <h3 className="font-semibold text-white">Invoice Details</h3>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="glass-button-primary py-1.5 px-3 flex items-center gap-1.5 text-xs">
                  <Printer className="w-4 h-4" />
                  Print Invoice
                </button>
                <button onClick={() => setActiveOrderPreview(null)} className="glass-button-secondary py-1.5 px-3 text-xs">
                  Close
                </button>
              </div>
            </div>

            {/* Receipt Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-dark-950/20">
              
              {/* Internal Profit Analysis Card (Owner Only) - Hidden on print */}
              <div className="no-print glass-panel p-5 rounded-xl border border-dark-850 bg-dark-900/60 max-w-md mx-auto space-y-4 shadow-lg text-left">
                <div className="flex justify-between items-center border-b border-dark-800 pb-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Internal Profit Analysis (Owner Only)
                  </h4>
                  <span className="text-xs text-dark-400 font-mono">
                    Order: #{activeOrderPreview.order.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                
                <div className="divide-y divide-dark-850 max-h-48 overflow-y-auto scrollbar-thin">
                  {activeOrderPreview.items.map((oi, idx) => {
                    const prod = products.find(p => p.id === oi.product_id);
                    const cost = getItemCost(oi);
                    const selling = Number(oi.unit_price);
                    const qty = Number(oi.quantity);
                    const profitPerUnit = selling - cost;
                    const itemProfit = profitPerUnit * qty;
                    
                    return (
                      <div key={idx} className="py-2.5 flex justify-between items-start gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-semibold text-white">
                            {prod ? `${prod.name_kh} (${prod.name_en})` : 'Unknown Product'}
                          </div>
                          <div className="text-[10px] text-dark-400 flex items-center gap-1.5">
                            <span>Cost: ${cost.toFixed(2)}</span>
                            <span>•</span>
                            <span>Sell: ${selling.toFixed(2)}</span>
                            <span>•</span>
                            <span>Qty: {qty}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block">+${itemProfit.toFixed(2)}</span>
                          <span className="text-[9px] text-dark-500">(${profitPerUnit.toFixed(2)}/unit)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-dark-800 pt-3 flex justify-between items-center text-sm font-bold">
                  <span className="text-dark-300">Total Order Profit:</span>
                  <span className="text-lg text-emerald-400">
                    ${activeOrderPreview.items.reduce((sum, oi) => sum + (Number(oi.unit_price) - getItemCost(oi)) * Number(oi.quantity), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Printable Invoice - Customer Copy */}
              <div className="max-w-md mx-auto border border-gray-300 p-6 bg-white shadow-sm print-card text-black font-sans text-left">
                
                {/* Receipt Header */}
                <div className="text-center space-y-2 border-b pb-4 border-dashed border-gray-300">
                  <h1 className="text-xl font-bold uppercase tracking-wider text-black">វិក្កយបត្រ / INVOICE</h1>
                  <h2 className="text-lg font-bold text-black font-mono">
                    {activeOrderPreview.customer?.name || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)'}
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {activeOrderPreview.customer?.location_note || 'ផ្សារអូរឫស្សី, ភ្នំពេញ'}
                    {activeOrderPreview.customer?.phone ? ` • ទូរស័ព្ទ: ${activeOrderPreview.customer.phone}` : ''}
                  </p>
                  
                  <div className="text-left text-xs grid grid-cols-2 gap-y-1 pt-2 font-mono text-gray-700">
                    <div><strong>Invoice No:</strong> #{activeOrderPreview.order.id.slice(-6).toUpperCase()}</div>
                    <div><strong>Date:</strong> {new Date(activeOrderPreview.order.ordered_at).toLocaleDateString()}</div>
                    <div className="col-span-2"><strong>Customer:</strong> {activeOrderPreview.customer?.name}</div>
                    {activeOrderPreview.customer?.phone && <div className="col-span-2"><strong>Phone:</strong> {activeOrderPreview.customer.phone}</div>}
                    {activeOrderPreview.customer?.location_note && <div className="col-span-2"><strong>Address:</strong> {activeOrderPreview.customer.location_note}</div>}
                  </div>
                </div>

                {/* Table items */}
                <table className="w-full text-xs text-left mt-4 border-b border-dashed border-gray-300 pb-4">
                  <thead>
                    <tr className="border-b border-gray-300 font-bold text-gray-800">
                      <th className="py-2">Description / ទំនិញ</th>
                      <th className="py-2 text-center">Qty / 数量</th>
                      <th className="py-2 text-right">Price / តម្លៃ</th>
                      <th className="py-2 text-right">Total / សរុប</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeOrderPreview.items.map((item, index) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <tr key={index} className="text-gray-800">
                          <td className="py-2">
                            <div className="font-bold">{prod?.name_kh}</div>
                            <div className="text-[10px] text-gray-500">{prod?.name_en}</div>
                          </td>
                          <td className="py-2 text-center font-mono">{item.quantity}</td>
                          <td className="py-2 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                          <td className="py-2 text-right font-mono">${Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Totals block */}
                <div className="mt-4 space-y-1.5 text-xs text-right font-mono">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal / សរុបបណ្តោះអាសន្ន:</span>
                    <span>${(activeOrderPreview.order.total_amount - activeOrderPreview.order.delivery_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Delivery / ថ្លៃដឹកជញ្ជូន:</span>
                    <span>${Number(activeOrderPreview.order.delivery_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-double pt-2 text-sm font-bold text-black">
                    <span>Grand Total / សរុបរួម:</span>
                    <span>${Number(activeOrderPreview.order.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer terms */}
                <div className="mt-6 text-center space-y-1 border-t border-dashed border-gray-300 pt-4 text-[10px] text-gray-500">
                  <p>សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you for your support!)</p>
                  <p className="font-mono">Wholesale Portal Invoice System</p>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Actual Hidden print layout for window.print() */}
      {activeOrderPreview && (
        <div className="hidden print-only bg-white text-black p-4 font-sans leading-normal">
          <div className="max-w-md mx-auto border-0 p-2">
            
            {/* Header */}
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-400">
              <h1 className="text-lg font-bold tracking-wider">
                {activeOrderPreview.customer?.name || 'ស្រីពៅ លក់ចាប់ហួយ (Zeii Pov Shop)'}
              </h1>
              <p className="text-[10px]">
                វិក្កយបត្រ / INVOICE
                {activeOrderPreview.customer?.location_note ? ` • ${activeOrderPreview.customer.location_note}` : ''}
                {activeOrderPreview.customer?.phone ? ` • Tel: ${activeOrderPreview.customer.phone}` : ''}
              </p>
              
              <div className="text-left text-[10px] grid grid-cols-2 gap-y-0.5 pt-2 font-mono">
                <div>No: #{activeOrderPreview.order.id.slice(-6).toUpperCase()}</div>
                <div>Date: {new Date(activeOrderPreview.order.ordered_at).toLocaleDateString()}</div>
                <div className="col-span-2">Customer: {activeOrderPreview.customer?.name}</div>
                {activeOrderPreview.customer?.phone && <div className="col-span-2">Phone: {activeOrderPreview.customer.phone}</div>}
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-[10px] text-left mt-2 border-b border-dashed border-gray-400 pb-2">
              <thead>
                <tr className="border-b border-gray-400 font-bold">
                  <th className="py-1">Product</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {activeOrderPreview.items.map((item, index) => {
                  const prod = products.find(p => p.id === item.product_id);
                  return (
                    <tr key={index}>
                      <td className="py-1">
                        <div className="font-bold">{prod?.name_kh}</div>
                        <div className="text-[9px] text-gray-500">{prod?.name_en}</div>
                      </td>
                      <td className="py-1 text-center font-mono">{item.quantity}</td>
                      <td className="py-1 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">${Number(item.subtotal).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-2 space-y-1 text-[10px] text-right font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${(activeOrderPreview.order.total_amount - activeOrderPreview.order.delivery_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>${Number(activeOrderPreview.order.delivery_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-double pt-1 font-bold">
                <span>Grand Total:</span>
                <span>${Number(activeOrderPreview.order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Terms */}
            <div className="mt-4 text-center text-[9px] text-gray-500">
              <p>សូមអរគុណ ចំពោះការគាំទ្រ! (Thank you!)</p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
