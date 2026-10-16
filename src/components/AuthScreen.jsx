import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Sun, 
  Moon, 
  Send
} from 'lucide-react';
import { auth } from '../services/auth';
import { getTelegramUser, isTelegramMiniApp, telegramHaptic } from '../services/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function AuthScreen({ onLoginSuccess, theme, toggleTheme }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Telegram Mini App User Detection
  const [telegramUser, setTelegramUser] = useState(null);

  useEffect(() => {
    if (isTelegramMiniApp()) {
      const tgUser = getTelegramUser();
      if (tgUser) {
        setTelegramUser(tgUser);
      }
    }
  }, []);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (Strictly role 'user')
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await auth.login({
        identifier: loginIdentifier,
        password: loginPassword
      });

      if (result.success) {
        setSuccessMsg(`Welcome back, ${result.user.name}!`);
        telegramHaptic('medium');
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 250);
      } else {
        setErrorMsg(result.error || 'Login failed. Please check your credentials.');
        telegramHaptic('error');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during login.');
      telegramHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password confirmation.');
      telegramHaptic('error');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      telegramHaptic('error');
      return;
    }

    setLoading(true);

    try {
      // Registration is strictly locked to role 'user'
      const result = await auth.register({
        name: regName,
        email: regEmail,
        password: regPassword
      });

      if (result.success) {
        setSuccessMsg(`Account created! Welcome, ${result.user.name}.`);
        telegramHaptic('success');
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 300);
      } else {
        setErrorMsg(result.error || 'Failed to create account.');
        telegramHaptic('error');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during registration.');
      telegramHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  // Seamless Telegram Mini App Login
  const handleTelegramAuth = async () => {
    if (!telegramUser) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await auth.loginWithTelegram(telegramUser);
      if (result.success) {
        setSuccessMsg(`Connected via Telegram! Welcome, ${result.user.name}.`);
        telegramHaptic('success');
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 200);
      } else {
        setErrorMsg(result.error || 'Telegram authentication failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Telegram authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-background text-foreground relative overflow-hidden font-sans select-none">
      {/* Background Accent Mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#000080]/5 via-primary-500/5 to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Top Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-border/60 bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#000080] flex items-center justify-center font-black text-white shadow-xs text-sm tracking-tight">
            WP
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider text-foreground leading-tight">WHOLESALE</h1>
            <p className="text-[10px] font-bold text-[#000080] dark:text-blue-400 tracking-widest uppercase">Portal & Catalog</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {telegramUser && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-[#0088cc]/40 text-[#0088cc] bg-[#0088cc]/10 flex items-center gap-1 font-semibold">
              <Send className="w-3 h-3" />
              <span>Telegram App</span>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#000080]" />}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl shadow-black/5 overflow-hidden transition-all duration-200">
          
          {/* Header Banner */}
          <div className="p-6 pb-4 text-center border-b border-border/60 bg-muted/20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#000080]/10 text-[#000080] dark:text-blue-400 mb-3 border border-[#000080]/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {tab === 'login' ? 'Sign In to Your Account' : 'Customer Registration'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {tab === 'login' 
                ? 'Sign in to access your wholesale dashboard or browse catalog.' 
                : 'Create your account to browse wholesale products and current retail prices.'}
            </p>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl mt-5 border border-border/80">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === 'login' 
                    ? 'bg-card text-foreground shadow-xs' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === 'register' 
                    ? 'bg-card text-foreground shadow-xs' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-4">
            
            {/* Telegram Mini App Fast Login Button (Only visible if opened inside Telegram) */}
            {telegramUser && (
              <div className="p-3.5 rounded-xl border border-[#0088cc]/30 bg-[#0088cc]/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0088cc] flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    Telegram Account Detected
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[#0088cc]/40 text-[#0088cc]">
                    1-Tap Entry
                  </Badge>
                </div>
                <Button
                  type="button"
                  onClick={handleTelegramAuth}
                  disabled={loading}
                  className="w-full h-9 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold gap-2 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Continue as {telegramUser.first_name || telegramUser.username || 'Telegram User'}
                </Button>
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase tracking-wider">or with credentials</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>
              </div>
            )}

            {/* Feedback Alerts */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {tab === 'login' ? (
              /* LOGIN FORM */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Username or Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      required
                      placeholder="Enter username or email"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="pl-9 h-10 text-sm"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-9 pr-10 h-10 text-sm"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-[#000080] hover:bg-[#000066] text-white font-semibold text-sm gap-2 mt-2 shadow-xs cursor-pointer"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              /* REGISTER FORM (STRICTLY FOR ROLE 'USER') */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="pl-9 h-9.5 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="pl-9 h-9.5 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Password (Min 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="pl-9 pr-10 h-9.5 text-sm"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="pl-9 pr-10 h-9.5 text-sm"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Information Security Note */}
                <div className="p-2.5 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#000080] dark:text-blue-400 flex-shrink-0" />
                  <span>
                    New accounts receive Customer access to browse product images and selling prices.
                  </span>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-[#000080] hover:bg-[#000066] text-white font-semibold text-sm gap-2 mt-2 shadow-xs cursor-pointer"
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

          </div>

          {/* Footer Security Badge */}
          <div className="p-3 bg-muted/30 border-t border-border/60 text-center flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              Encrypted credentials with SHA-256 and brute-force protection
            </span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-3 px-6 text-center text-xs text-muted-foreground border-t border-border/40">
        © 2026 Wholesale Portal System • Multi-Role Access Control
      </footer>
    </div>
  );
}
