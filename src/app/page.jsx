"use client";

import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { 
  ShoppingCart, 
  LogIn, 
  LogOut, 
  User, 
  Search, 
  Tag, 
  Layers, 
  MapPin, 
  Phone, 
  RefreshCw, 
  X, 
  Plus, 
  Minus, 
  Check, 
  ArrowRight, 
  ShoppingBag,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  Mail
} from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export default function StorefrontPage() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Cart state
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(1.00);
  
  // Auth Modal general state
  const [currentUser, setCurrentUser] = useState(null); // { user, customer }
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register' | 'forgot'
  
  // Registration Flow state (OTP-verified)
  const [regStep, setRegStep] = useState('input'); // 'input' | 'verify'
  const [regOtpCode, setRegOtpCode] = useState('');
  
  // Password Recovery state (OTP-verified)
  const [recoveryStep, setRecoveryStep] = useState('request'); // 'request' | 'verify' | 'reset'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtpCode, setRecoveryOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // General Auth Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  
  // Checkout state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutLocation, setCheckoutLocation] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');

  // Load catalog data & check session
  const loadStoreData = async () => {
    setLoading(true);
    try {
      const [prods, bnds, cats, session] = await Promise.all([
        db.getProducts(),
        db.getBrands(),
        db.getCategories(),
        db.getCurrentCustomer()
      ]);
      setProducts(prods || []);
      setBrands(bnds || []);
      setCategories(cats || []);
      setCurrentUser(session);
      
      if (session?.customer) {
        setCheckoutName(session.customer.name || '');
        setCheckoutPhone(session.customer.phone || '');
        setCheckoutLocation(session.customer.location_note || '');
      }
    } catch (err) {
      console.error('Error loading store data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStoreData();
  }, []);

  // Update checkout details when user logs in/out
  useEffect(() => {
    if (currentUser?.customer) {
      setCheckoutName(currentUser.customer.name || '');
      setCheckoutPhone(currentUser.customer.phone || '');
      setCheckoutLocation(currentUser.customer.location_note || '');
    } else {
      setCheckoutName('');
      setCheckoutPhone('');
      setCheckoutLocation('');
    }
  }, [currentUser]);

  // Auth Modal toggle helper
  const openAuth = (tab = 'login') => {
    setAuthTab(tab);
    setRegStep('input');
    setRecoveryStep('request');
    setAuthError('');
    setAuthSuccess('');
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setLocationNote('');
    setRegOtpCode('');
    setRecoveryEmail('');
    setRecoveryOtpCode('');
    setNewPassword('');
    setIsAuthModalOpen(true);
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await db.signInWithGoogle();
    } catch (err) {
      setAuthError(err.message || 'Google login failed');
    }
  };

  // Auth Form Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    try {
      if (authTab === 'login') {
        // --- Password Login ---
        const session = await db.signInCustomer(email, password);
        setCurrentUser(session);
        setAuthSuccess('Welcome back! Logged in successfully.');
        setTimeout(() => {
          setIsAuthModalOpen(false);
          setAuthSuccess('');
          setEmail('');
          setPassword('');
        }, 1500);
      } else if (authTab === 'register') {
        // --- Registration Trigger (Sends OTP) ---
        if (!name || !phone) {
          throw new Error('Please fill in Name and Phone Number');
        }
        await db.signUpCustomer(email, password);
        setAuthSuccess('Verification code sent to your email. Please check your inbox.');
        setRegStep('verify');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Confirm Sign Up OTP
  const handleConfirmSignupOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    try {
      const session = await db.verifySignupOtp(email, regOtpCode, name, phone, locationNote);
      setCurrentUser(session);
      setAuthSuccess('Account verified and profile created successfully!');
      setTimeout(() => {
        setIsAuthModalOpen(false);
        setAuthSuccess('');
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
        setLocationNote('');
        setRegOtpCode('');
        setRegStep('input');
      }, 1500);
    } catch (err) {
      setAuthError(err.message || 'Invalid confirmation code');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Forgot Password Phase 1: Request Code
  const handleRequestPasswordReset = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    try {
      await db.sendPasswordResetOtp(recoveryEmail);
      setAuthSuccess('Password recovery code sent to your email.');
      setRecoveryStep('verify');
    } catch (err) {
      setAuthError(err.message || 'Failed to send recovery code');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Forgot Password Phase 2: Verify Code
  const handleVerifyPasswordResetOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    try {
      await db.verifyResetOtp(recoveryEmail, recoveryOtpCode);
      setAuthSuccess('Code verified! Please enter your new password.');
      setRecoveryStep('reset');
    } catch (err) {
      setAuthError(err.message || 'Invalid recovery code');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Forgot Password Phase 3: Update Password
  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthSubmitting(true);

    if (newPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      setAuthSubmitting(false);
      return;
    }

    try {
      await db.updatePassword(newPassword);
      setAuthSuccess('Password reset successful! You can now log in.');
      setTimeout(() => {
        openAuth('login');
      }, 1500);
    } catch (err) {
      setAuthError(err.message || 'Failed to update password');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await db.signOutCustomer();
      setCurrentUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Cart operations
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const price = product.selling_price && Number(product.selling_price) > 0 
        ? Number(product.selling_price) 
        : (product.base_price + 0.20);
        
      return [...prev, {
        product_id: product.id,
        name_kh: product.name_kh,
        name_en: product.name_en,
        image_url: product.image_url,
        unit_price: price,
        quantity: 1
      }];
    });
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const cartTotal = cartSubtotal + Number(deliveryFee);

  // Telegram Notifications API Fetch Call
  const sendTelegramNotification = async (orderId, customerName, customerPhone, deliveryLocation, cartItems, totalAmount, deliveryFee) => {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('Telegram credentials not configured. Skipping bot notification.');
      return;
    }

    let message = `🔔 <b>NEW WHOLESALE ORDER</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🆔 <b>Order ID:</b> <code>#${orderId.slice(0, 8).toUpperCase()}</code>\n`;
    message += `👤 <b>Customer:</b> ${customerName}\n`;
    message += `📞 <b>Phone:</b> ${customerPhone}\n`;
    if (deliveryLocation) {
      message += `📍 <b>Delivery:</b> ${deliveryLocation}\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 <b>Skincare Products:</b>\n`;
    
    cartItems.forEach((item, idx) => {
      message += `${idx + 1}. <b>${item.name_kh}</b>\n`;
      message += `   <code>${item.quantity}</code> x $${item.unit_price.toFixed(2)} = <b>$${(item.unit_price * item.quantity).toFixed(2)}</b>\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🚚 <b>Delivery Fee:</b> $${Number(deliveryFee).toFixed(2)}\n`;
    message += `💰 <b>Grand Total:</b> <b>$${Number(totalAmount).toFixed(2)}</b>\n`;
    message += `⏳ <b>Status:</b> <code>PENDING</code>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕒 <i>Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' })} (Phnom Penh)</i>`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      if (!res.ok) {
        console.error('Telegram API error response:', await res.json());
      } else {
        console.log('Telegram order notification dispatched!');
      }
    } catch (err) {
      console.error('Failed to notify Telegram Bot:', err);
    }
  };

  // Checkout order placement handler
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutSubmitting(true);

    if (!checkoutName || !checkoutPhone) {
      setCheckoutError('Name and Phone Number are required.');
      setCheckoutSubmitting(false);
      return;
    }

    try {
      let customerId = currentUser?.customer?.id;
      
      if (!customerId) {
        const allCusts = await db.getCustomers();
        const existing = allCusts.find(c => c.phone === checkoutPhone);
        if (existing) {
          customerId = existing.id;
        } else {
          const newCust = await db.saveCustomer({
            name: checkoutName,
            phone: checkoutPhone,
            location_note: checkoutLocation
          });
          customerId = newCust.id;
        }
      }

      const orderObj = {
        customer_id: customerId,
        delivery_fee: Number(deliveryFee),
        total_amount: Number(cartTotal),
        status: 'pending'
      };

      const itemsData = cart.map(item => ({
        product_id: item.product_id,
        supplier_id: null,
        supplier_price: 0,
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: item.unit_price * item.quantity
      }));

      const newOrder = await db.createOrder(orderObj, itemsData);
      
      // Notify Telegram Bot
      sendTelegramNotification(
        newOrder.id,
        checkoutName,
        checkoutPhone,
        checkoutLocation,
        cart,
        cartTotal,
        deliveryFee
      ).catch(err => console.error(err));
      
      // Confetti celebration
      import('canvas-confetti').then((module) => {
        const confetti = module.default;
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      });

      setLastOrderNumber(newOrder.id.slice(0, 8).toUpperCase());
      setOrderComplete(true);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (err) {
      setCheckoutError(err.message || 'Failed to place order');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name_kh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name_en.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrand === 'all' || product.brand_id === selectedBrand;
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    return matchesSearch && matchesBrand && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex flex-col font-sans">
      {/* Top Banner Navigation */}
      <header className="h-16 border-b border-dark-800/40 bg-dark-950/60 backdrop-blur-md sticky top-0 z-40 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <ShoppingBag className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-wider text-base leading-none">NARY SKINCARE</h1>
            <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest mt-0.5 block">Storefront</span>
          </div>
        </div>

        {/* User Account Controls */}
        <div className="flex items-center gap-4">
          <a 
            href="/admin" 
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-dark-800 bg-dark-900/60 hover:bg-dark-800 text-xs font-semibold text-dark-200 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            Admin Dashboard
            <ChevronRight className="w-3.5 h-3.5" />
          </a>

          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-white">{currentUser.customer?.name || currentUser.user.email}</p>
                <p className="text-[10px] text-dark-400 font-medium">Customer Account</p>
              </div>
              <button 
                onClick={handleSignOut}
                className="p-2 rounded-xl border border-dark-800 bg-dark-900/60 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-dark-400 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => openAuth('login')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-all shadow-md shadow-primary-500/20 active:scale-95 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Login / Register
            </button>
          )}

          {/* Cart Icon Button */}
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-dark-900 border border-dark-800 text-white hover:bg-dark-800 transition-all cursor-pointer"
          >
            <ShoppingCart className="w-4.5 h-4.5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center text-white border border-dark-950">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="px-6 md:px-12 py-8 bg-gradient-to-b from-dark-900/40 via-dark-950 to-dark-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              Premium Skincare Wholesaler
            </h2>
            <p className="text-dark-400 text-sm mt-2 max-w-xl">
              Log in to purchase, track your orders, and access personalized client prices. We deliver directly to your salon or shop across Cambodia.
            </p>
          </div>
          
          {/* Quick Filters */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input pl-9 w-full text-xs"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="glass-input text-xs"
              >
                <option value="all">All Brands</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="glass-input text-xs"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-12 pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] gap-3 text-dark-400">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-400" />
            <span className="text-sm font-semibold">Loading catalog...</span>
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredProducts.map(product => {
                const isItemInCart = cart.some(i => i.product_id === product.id);
                const computedPrice = product.selling_price && Number(product.selling_price) > 0 
                  ? Number(product.selling_price) 
                  : (product.base_price + 0.20);
                  
                return (
                  <div 
                    key={product.id}
                    className="glass-panel hover-glow border border-dark-800/40 rounded-2xl p-3 flex flex-col justify-between group overflow-hidden bg-dark-900/20"
                  >
                    <div>
                      {/* Thumbnail Image Container */}
                      <div className="w-full aspect-square rounded-xl overflow-hidden bg-dark-950 border border-dark-800/50 flex items-center justify-center relative">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name_en} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ShoppingBag className="w-8 h-8 text-dark-700" />
                        )}
                        {/* Brand Badge */}
                        {product.brand_id && brands.find(b => b.id === product.brand_id) && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[9px] font-bold border border-primary-500/20 bg-primary-950/80 text-primary-400 backdrop-blur-xs leading-none">
                            {brands.find(b => b.id === product.brand_id).name}
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="mt-3">
                        <h4 className="font-semibold text-white text-xs line-clamp-1 group-hover:text-primary-400 transition-colors">
                          {product.name_kh}
                        </h4>
                        <p className="text-[10px] text-dark-400 line-clamp-1 mt-0.5">{product.name_en}</p>
                      </div>
                    </div>

                    {/* Price and Cart Action */}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-white font-bold text-sm font-mono">
                        ${computedPrice.toFixed(2)}
                      </span>
                      
                      {isItemInCart ? (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => updateCartQty(product.id, -1)}
                            className="p-1 rounded-lg bg-dark-800 text-dark-300 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs text-white font-bold px-1.5 font-mono">
                            {cart.find(i => i.product_id === product.id).quantity}
                          </span>
                          <button 
                            onClick={() => addToCart(product)}
                            className="p-1 rounded-lg bg-dark-800 text-dark-300 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(product)}
                          className="px-2.5 py-1.5 rounded-lg bg-primary-600/10 border border-primary-500/20 text-primary-400 hover:bg-primary-600 hover:text-white text-[10px] font-bold transition-all duration-200 cursor-pointer"
                        >
                          Add +
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[30vh] text-dark-500 gap-2 border border-dark-900 border-dashed rounded-3xl p-8">
                <ShoppingBag className="w-8 h-8 text-dark-700" />
                <p className="text-sm italic font-medium">No skincare products found matching your filters.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Cart Sidebar Drawer Panel */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-dark-900 border-l border-dark-800 shadow-2xl flex flex-col justify-between">
              
              {/* Cart Header */}
              <div className="p-6 border-b border-dark-800 flex items-center justify-between bg-dark-950/40">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4.5 h-4.5 text-primary-400" />
                  <h3 className="font-bold text-sm text-white">Your Shopping Cart</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cart items list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-dark-500 gap-3">
                    <ShoppingBag className="w-12 h-12 text-dark-850" />
                    <p className="text-xs italic font-medium">Your cart is empty. Add some products to start!</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.product_id} className="flex gap-4 border-b border-dark-800/40 pb-4">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-dark-950 border border-dark-800/50 flex-shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name_en} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-dark-700" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white text-xs truncate">{item.name_kh}</h4>
                        <p className="text-[10px] text-dark-400 truncate mt-0.5">{item.name_en}</p>
                        
                        <div className="flex items-center justify-between mt-2">
                          {/* Qty controls */}
                          <div className="flex items-center gap-1 border border-dark-800 bg-dark-950/60 px-1 py-0.5 rounded-lg">
                            <button 
                              onClick={() => updateCartQty(item.product_id, -1)}
                              className="p-1 text-dark-400 hover:text-white transition-colors"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs text-white font-bold px-1.5 font-mono">{item.quantity}</span>
                            <button 
                              onClick={() => updateCartQty(item.product_id, 1)}
                              className="p-1 text-dark-400 hover:text-white transition-colors"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-xs text-dark-400 block">${item.unit_price.toFixed(2)} each</span>
                            <span className="text-xs font-bold text-white font-mono">${(item.unit_price * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-dark-500 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Cart calculations & Checkout CTA */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-dark-800 bg-dark-950/40 space-y-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-dark-400">
                      <span>Subtotal</span>
                      <span className="font-mono text-white font-semibold">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-dark-400">
                      <span>Delivery Fee</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span>$</span>
                        <input 
                          type="number"
                          step="0.5"
                          min="0"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value)))}
                          className="glass-input w-16 px-1.5 py-0.5 text-center text-xs font-semibold text-white font-mono"
                        />
                      </div>
                    </div>
                    
                    <div className="border-t border-dark-800/80 my-2 pt-2 flex justify-between text-sm">
                      <span className="font-bold text-white">Total Amount</span>
                      <span className="font-bold text-primary-400 font-mono">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setIsCheckoutOpen(true);
                      setIsCartOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-500/20 active:scale-98 cursor-pointer"
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Checkout Dialog Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handlePlaceOrder}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-150"
          >
            <div className="p-6 border-b border-dark-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">Shipping & Contact Info</h3>
                <p className="text-xs text-dark-400 mt-1">Please provide details to complete your skincare order.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {checkoutError && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  {checkoutError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Customer Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Sok Cheat"
                  value={checkoutName}
                  onChange={(e) => setCheckoutName(e.target.value)}
                  className="glass-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-primary-400" />
                  Phone Number
                </label>
                <input 
                  type="tel"
                  required
                  placeholder="e.g. 012 345 678"
                  value={checkoutPhone}
                  onChange={(e) => setCheckoutPhone(e.target.value)}
                  className="glass-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary-400" />
                  Delivery Location Note
                </label>
                <textarea 
                  rows="3"
                  placeholder="e.g. Salon ABC, opposite Phsar Thmei, House 123, Street 456..."
                  value={checkoutLocation}
                  onChange={(e) => setCheckoutLocation(e.target.value)}
                  className="glass-input w-full text-xs"
                />
              </div>

              <div className="p-4 rounded-xl bg-dark-950/50 border border-dark-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-dark-400 font-medium">Order Total</span>
                  <span className="text-dark-500 block text-[10px]">({cart.reduce((s, i) => s + i.quantity, 0)} items + delivery)</span>
                </div>
                <strong className="text-primary-400 font-bold text-base font-mono">${cartTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="p-6 border-t border-dark-800 bg-dark-950/20 flex gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setIsCartOpen(true);
                }}
                className="flex-1 py-2.5 rounded-xl border border-dark-800 bg-dark-900/60 hover:bg-dark-800 text-xs font-semibold text-dark-200"
              >
                Back to Cart
              </button>
              <button 
                type="submit"
                disabled={checkoutSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs transition-all shadow-md shadow-primary-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {checkoutSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer Order Success Dialog */}
      {orderComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-dark-900 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Check className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="font-bold text-lg text-white">Order Placed Successfully!</h3>
              <p className="text-xs text-dark-400 mt-2">
                Thank you for your purchase. Your order number is <strong className="text-white font-mono text-xs">#{lastOrderNumber}</strong>. We will contact you shortly to confirm shipment.
              </p>
            </div>

            <button 
              onClick={() => setOrderComplete(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs transition-all active:scale-95 cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Premium Auth Modal (Login / Register / Forgot Tabs) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="border-b border-dark-800 flex justify-between items-center p-4 bg-dark-950/40">
              <div className="flex gap-2 items-center">
                <ShieldCheck className="w-5 h-5 text-primary-400" />
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                  {authTab === 'login' && 'Client Login'}
                  {authTab === 'register' && 'Create Account'}
                  {authTab === 'forgot' && 'Account Recovery'}
                </h3>
              </div>
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-dark-850 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Errors & Success Notifications */}
              {authError && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {authSuccess}
                </div>
              )}

              {/* A. LOGIN TAB VIEW */}
              {authTab === 'login' && (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full py-2.5 rounded-xl border border-dark-800 bg-dark-950 hover:bg-dark-850 hover:border-dark-700 font-semibold text-xs text-white flex items-center justify-center transition-all cursor-pointer"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>

                  <div className="relative flex items-center justify-center my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dark-800/80"></div>
                    </div>
                    <span className="relative px-3 bg-dark-900 text-[10px] text-dark-500 font-bold uppercase tracking-widest">Or login with password</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Email Address</label>
                    <input 
                      type="email"
                      required
                      placeholder="client@salon.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="glass-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest">Password</label>
                      <button
                        type="button"
                        onClick={() => openAuth('forgot')}
                        className="text-[10px] font-bold text-primary-400 hover:text-primary-300 hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <input 
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="glass-input w-full text-xs"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary-500/10 active:scale-98 cursor-pointer mt-6"
                  >
                    {authSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Logging In...
                      </>
                    ) : (
                      'Log In'
                    )}
                  </button>
                  
                  <p className="text-center text-[10px] text-dark-400 mt-4">
                    Don't have a wholesale account?{' '}
                    <button 
                      type="button" 
                      onClick={() => openAuth('register')} 
                      className="text-primary-400 font-bold hover:underline cursor-pointer"
                    >
                      Register here
                    </button>
                  </p>
                </form>
              )}

              {/* B. REGISTER TAB VIEW */}
              {authTab === 'register' && (
                <>
                  {regStep === 'input' ? (
                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                      {/* Google OAuth Button */}
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full py-2.5 rounded-xl border border-dark-800 bg-dark-950 hover:bg-dark-850 hover:border-dark-700 font-semibold text-xs text-white flex items-center justify-center transition-all cursor-pointer"
                      >
                        <GoogleIcon />
                        Sign up with Google
                      </button>

                      <div className="relative flex items-center justify-center my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-dark-800/80"></div>
                        </div>
                        <span className="relative px-3 bg-dark-900 text-[10px] text-dark-500 font-bold uppercase tracking-widest">Or enter email details</span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Email Address</label>
                        <input 
                          type="email"
                          required
                          placeholder="client@salon.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Password</label>
                        <input 
                          type="password"
                          required
                          placeholder="Minimum 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Full Name / Salon Name</label>
                        <input 
                          type="text"
                          required
                          placeholder="Leakhena Beauty Salon"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Phone Number</label>
                        <input 
                          type="tel"
                          required
                          placeholder="099 888 777"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Default Delivery Location</label>
                        <textarea 
                          rows="2"
                          placeholder="Near Phsar Orussey, St. 182..."
                          value={locationNote}
                          onChange={(e) => setLocationNote(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary-500/10 active:scale-98 cursor-pointer mt-6"
                      >
                        {authSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Sending Verification Email...
                          </>
                        ) : (
                          'Request OTP Code'
                        )}
                      </button>

                      <p className="text-center text-[10px] text-dark-400 mt-4">
                        Already have an account?{' '}
                        <button 
                          type="button" 
                          onClick={() => openAuth('login')} 
                          className="text-primary-400 font-bold hover:underline cursor-pointer"
                        >
                          Login here
                        </button>
                      </p>
                    </form>
                  ) : (
                    // Signup verification step (OTP input)
                    <form onSubmit={handleConfirmSignupOtp} className="space-y-4">
                      <div className="text-center p-4 bg-primary-600/5 border border-primary-500/10 rounded-2xl mb-4">
                        <Mail className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                        <h4 className="text-xs font-bold text-white">Enter OTP Code</h4>
                        <p className="text-[10px] text-dark-400 mt-1">We sent a 6-digit confirmation code to <strong>{email}</strong>.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Verification Code</label>
                        <input 
                          type="text"
                          required
                          maxLength="6"
                          placeholder="123456"
                          value={regOtpCode}
                          onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="glass-input w-full text-center text-sm font-bold tracking-widest py-3 font-mono"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary-500/10 active:scale-98 cursor-pointer"
                      >
                        {authSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Confirm & Complete Signup'
                        )}
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setRegStep('input')}
                        className="w-full text-center text-[10px] text-dark-400 hover:text-white underline cursor-pointer mt-4"
                      >
                        Go back to details
                      </button>
                    </form>
                  )}
                </>
              )}

              {/* C. FORGOT PASSWORD TAB VIEW */}
              {authTab === 'forgot' && (
                <div className="space-y-4">
                  {recoveryStep === 'request' && (
                    <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                      <div className="text-center p-4 bg-dark-950/40 border border-dark-800 rounded-2xl mb-4">
                        <KeyRound className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                        <h4 className="text-xs font-bold text-white">Reset Password</h4>
                        <p className="text-[10px] text-dark-400 mt-1">Enter your email and we will send a recovery code.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Registered Email</label>
                        <input 
                          type="email"
                          required
                          placeholder="client@salon.com"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary-500/10 active:scale-98 cursor-pointer"
                      >
                        {authSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Requesting Code...
                          </>
                        ) : (
                          'Send Recovery Code'
                        )}
                      </button>

                      <button 
                        type="button" 
                        onClick={() => openAuth('login')}
                        className="w-full text-center text-[10px] text-dark-400 hover:text-white underline cursor-pointer mt-4"
                      >
                        Back to Login
                      </button>
                    </form>
                  )}

                  {recoveryStep === 'verify' && (
                    <form onSubmit={handleVerifyPasswordResetOtp} className="space-y-4">
                      <div className="text-center p-4 bg-primary-600/5 border border-primary-500/10 rounded-2xl mb-4">
                        <Mail className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                        <h4 className="text-xs font-bold text-white">Enter Recovery Code</h4>
                        <p className="text-[10px] text-dark-400 mt-1">Check your inbox for code sent to <strong>{recoveryEmail}</strong>.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">Recovery Code</label>
                        <input 
                          type="text"
                          required
                          maxLength="6"
                          placeholder="654321"
                          value={recoveryOtpCode}
                          onChange={(e) => setRecoveryOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="glass-input w-full text-center text-sm font-bold tracking-widest py-3 font-mono"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary-500/10 active:scale-98 cursor-pointer"
                      >
                        {authSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify Recovery Code'
                        )}
                      </button>
                    </form>
                  )}

                  {recoveryStep === 'reset' && (
                    <form onSubmit={handleSaveNewPassword} className="space-y-4">
                      <div className="text-center p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mb-4">
                        <KeyRound className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <h4 className="text-xs font-bold text-white">Set New Password</h4>
                        <p className="text-[10px] text-dark-400 mt-1">Please enter your new administrative password.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-dark-300 uppercase tracking-widest mb-2">New Password</label>
                        <input 
                          type="password"
                          required
                          placeholder="Minimum 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="glass-input w-full text-xs"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10 active:scale-98 cursor-pointer"
                      >
                        {authSubmitting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Updating Password...
                          </>
                        ) : (
                          'Save & Complete Reset'
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Store Footer */}
      <footer className="py-6 border-t border-dark-850 bg-dark-950 text-center text-[10px] text-dark-500 tracking-wider">
        <p>&copy; {new Date().getFullYear()} NARY SKINCARE CO., LTD. ALL RIGHTS RESERVED.</p>
        <p className="mt-1">PHNOM PENH, CAMBODIA</p>
      </footer>
    </div>
  );
}
