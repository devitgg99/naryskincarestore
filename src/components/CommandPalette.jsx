import { useState, useEffect, useRef } from 'react';
import { Search, Navigation, Database, Users, Package, HelpCircle, X } from 'lucide-react';

export default function CommandPalette({ 
  onClose, 
  setActiveTab, 
  products = [], 
  customers = [], 
  onRefresh, 
  showToast 
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);



  // Prevent scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const navigationOptions = [
    { type: 'nav', label: 'Go to Dashboard', tab: 'dashboard', description: 'View analytics overview' },
    { type: 'nav', label: 'Go to Pricing Catalog', tab: 'pricing', description: 'Product list and supplier costs' },
    { type: 'nav', label: 'Go to Customer Directory', tab: 'customers', description: 'Customer details and histories' },
    { type: 'nav', label: 'Go to Invoice Builder', tab: 'invoice', description: 'Build and print invoice receipts' },
    { type: 'nav', label: 'Go to Sales Log', tab: 'sales', description: 'List historical orders and invoices' },
    { type: 'nav', label: 'Go to Stock Tracker', tab: 'stock', description: 'View and edit stock levels' },
    { type: 'nav', label: 'Go to Brand Manager', tab: 'brands', description: 'Manage brand categories' },
    { type: 'nav', label: 'Go to Category Manager', tab: 'categories', description: 'Manage item category listings' },
  ];

  const dbOptions = [
    { type: 'action', label: 'Sync Database', action: 'sync', description: 'Force sync client data with Supabase' },
  ];

  const getFilteredItems = () => {
    const term = query.toLowerCase();
    
    // 1. Filter Navigation
    const navs = navigationOptions.filter(n => 
      n.label.toLowerCase().includes(term) || n.description.toLowerCase().includes(term)
    );

    // 2. Filter Database Actions
    const dbs = dbOptions.filter(d => 
      d.label.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)
    );

    // 3. Filter Customers (limit to 5)
    const custs = customers
      .filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)))
      .slice(0, 5)
      .map(c => ({
        type: 'customer',
        label: `Customer: ${c.name}`,
        description: c.phone ? `Phone: ${c.phone}` : 'No phone',
        item: c
      }));

    // 4. Filter Products (limit to 5)
    const prods = products
      .filter(p => p.name_en.toLowerCase().includes(term) || p.name_kh.includes(term))
      .slice(0, 5)
      .map(p => ({
        type: 'product',
        label: `Product: ${p.name_kh} (${p.name_en})`,
        description: `Base Price: $${p.base_price.toFixed(2)}`,
        item: p
      }));

    return [...navs, ...dbs, ...custs, ...prods];
  };

  const filtered = getFilteredItems();

  const handleSelect = (option) => {
    if (!option) return;
    
    if (option.type === 'nav') {
      setActiveTab(option.tab);
      onClose();
    } else if (option.type === 'action') {
      if (option.action === 'sync') {
        onRefresh();
        showToast('Database synchronization started!', 'success');
        onClose();
      }
    } else if (option.type === 'customer') {
      setActiveTab('customers');
      // Trigger selection of that customer by storing ID or dispatching custom event if needed
      // For simplicity, we navigate to customer tab and let it select the active customer
      localStorage.setItem('wsp_palette_select_customer', option.item.id);
      window.dispatchEvent(new CustomEvent('wsp_select_customer', { detail: option.item.id }));
      onClose();
    } else if (option.type === 'product') {
      setActiveTab('pricing');
      localStorage.setItem('wsp_palette_select_product', option.item.id);
      window.dispatchEvent(new CustomEvent('wsp_select_product', { detail: option.item.id }));
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedIndex]);

  // Adjust scroll of results container to keep selected element in view
  useEffect(() => {
    const activeEl = resultsRef.current?.querySelector('.active-result');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const getIcon = (type) => {
    switch (type) {
      case 'nav': return <Navigation className="w-4 h-4 text-primary-400" />;
      case 'action': return <Database className="w-4 h-4 text-emerald-400" />;
      case 'customer': return <Users className="w-4 h-4 text-violet-400" />;
      case 'product': return <Package className="w-4 h-4 text-amber-400" />;
      default: return <HelpCircle className="w-4 h-4 text-dark-500" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg glass-panel rounded-2xl overflow-hidden shadow-2xl border border-dark-800 bg-dark-950 flex flex-col max-h-[460px] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="relative border-b border-dark-850 p-4">
          <Search className="w-5 h-5 absolute left-7 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Type a command, page name, product, or customer..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full pl-12 pr-10 py-3 bg-dark-900 border border-dark-800 focus:border-primary-500 rounded-xl text-sm font-semibold outline-none text-white transition-all shadow-inner"
          />
          <button 
            onClick={onClose}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white p-1 rounded-lg hover:bg-dark-800/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div 
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-2 divide-y divide-dark-900 scrollbar-thin max-h-[340px]"
        >
          {filtered.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={idx}
                onClick={() => handleSelect(opt)}
                className={`active-result p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                  isSelected 
                    ? 'bg-primary-500/10 border-l-2 border-primary-500 text-white' 
                    : 'text-dark-300 hover:bg-dark-900/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary-500/10' : 'bg-dark-900 border border-dark-850'}`}>
                    {getIcon(opt.type)}
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold block">{opt.label}</span>
                    <span className="text-[10px] text-dark-500 block mt-0.5">{opt.description}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded border border-primary-500/30">
                    Select
                  </span>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-dark-500 text-xs italic">
              No matching commands, products, or customers found.
            </div>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="p-3 border-t border-dark-850 bg-dark-950/60 text-[10px] text-dark-500 flex justify-between items-center px-6">
          <div className="flex gap-4">
            <span><kbd className="font-sans font-bold bg-dark-900 border border-dark-800 px-1 py-0.2 rounded shadow">↑↓</kbd> Navigate</span>
            <span><kbd className="font-sans font-bold bg-dark-900 border border-dark-800 px-1 py-0.2 rounded shadow">Enter</kbd> Select</span>
          </div>
          <span><kbd className="font-sans font-bold bg-dark-900 border border-dark-800 px-1 py-0.2 rounded shadow">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
