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
      case 'nav': return <Navigation className="w-4 h-4 text-[#000080] dark:text-blue-400" />;
      case 'action': return <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'customer': return <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case 'product': return <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default: return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-xs flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-xl border border-border bg-card text-foreground flex flex-col max-h-[460px] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="relative border-b border-border p-3">
          <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
            className="w-full pl-10 pr-9 py-2 bg-background border border-border focus:border-[#000080] focus:ring-1 focus:ring-[#000080] rounded-lg text-sm font-medium outline-none text-foreground transition-colors"
          />
          <button 
            onClick={onClose}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div 
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-2 divide-y divide-border/40 scrollbar-thin max-h-[340px]"
        >
          {filtered.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={idx}
                onClick={() => handleSelect(opt)}
                className={`active-result p-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                  isSelected 
                    ? 'bg-[#000080] text-white shadow-xs' 
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white/15 text-white' : 'bg-muted border border-border'}`}>
                    {getIcon(opt.type)}
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-semibold block">{opt.label}</span>
                    <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>{opt.description}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded">
                    Select
                  </span>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-xs italic">
              No matching commands, products, or customers found.
            </div>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="p-2.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex justify-between items-center px-4">
          <div className="flex gap-4">
            <span><kbd className="font-sans font-bold bg-background border border-border px-1.5 py-0.5 rounded shadow-xs text-foreground">↑↓</kbd> Navigate</span>
            <span><kbd className="font-sans font-bold bg-background border border-border px-1.5 py-0.5 rounded shadow-xs text-foreground">Enter</kbd> Select</span>
          </div>
          <span><kbd className="font-sans font-bold bg-background border border-border px-1.5 py-0.5 rounded shadow-xs text-foreground">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
