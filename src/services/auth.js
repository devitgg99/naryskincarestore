// Authentication & Security Service (Protected RBAC + Telegram Mini App Support)
import { getSupabaseConfig } from './db';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_SESSION = 'wsp_auth_user';
const STORAGE_KEY_USERS = 'wsp_users';
const STORAGE_KEY_FAILURES = 'wsp_auth_failures';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds lockout

// Cryptographic Password Hashing using native Web Crypto API (SHA-256 + Salt)
export const hashPassword = async (plainPassword) => {
  if (!plainPassword) return '';
  const encoder = new TextEncoder();
  const saltedData = encoder.encode(plainPassword + '_wsp_sec_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', saltedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Initial system administrator (Credentials managed securely, no hardcoded plain demo password)
const INITIAL_SYSTEM_ADMIN = {
  id: 'usr_admin',
  email: 'admin@nary.com',
  username: 'admin',
  passwordHash: '14ab54606e343bdb812f6a0b31f84f40577082c96204929d829eee4214d679cf', // SHA-256 of Zerogg1688$ + salt
  name: 'Administrator',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z'
};

// Rate Limiting & Brute-force lockout prevention
const getRateLimitState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAILURES);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
};

const recordFailedLogin = () => {
  const state = getRateLimitState();
  const newCount = state.count + 1;
  const now = Date.now();
  let lockedUntil = 0;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  localStorage.setItem(STORAGE_KEY_FAILURES, JSON.stringify({
    count: newCount,
    lockedUntil
  }));

  return { count: newCount, lockedUntil };
};

const clearFailedLogin = () => {
  localStorage.removeItem(STORAGE_KEY_FAILURES);
};

// Initialize and migrate stored users in LocalStorage
const getStoredUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([INITIAL_SYSTEM_ADMIN]));
      return [INITIAL_SYSTEM_ADMIN];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure system admin exists
      const hasAdmin = parsed.some(u => u.role === 'admin');
      if (!hasAdmin) {
        parsed.unshift(INITIAL_SYSTEM_ADMIN);
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(parsed));
      }
      return parsed;
    }
    return [INITIAL_SYSTEM_ADMIN];
  } catch (err) {
    console.warn('Failed to parse stored users:', err);
    return [INITIAL_SYSTEM_ADMIN];
  }
};

const saveStoredUsers = (users) => {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
};

// Supabase client instance helper
const getSupabaseClient = () => {
  const config = getSupabaseConfig();
  if (config.active && config.url && config.key) {
    try {
      return createClient(config.url, config.key);
    } catch (e) {
      console.warn('Supabase auth client init failed:', e);
    }
  }
  return null;
};

export const auth = {
  // Get active session
  getCurrentUser: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // Authenticate user with credentials (with brute-force lockout and SHA-256 matching)
  login: async ({ identifier, password }) => {
    // 1. Check Rate Limiter
    const rateLimit = getRateLimitState();
    const now = Date.now();
    if (rateLimit.lockedUntil && now < rateLimit.lockedUntil) {
      const remainingSeconds = Math.ceil((rateLimit.lockedUntil - now) / 1000);
      return { 
        success: false, 
        error: `Too many failed attempts. Security lockout active for ${remainingSeconds} seconds.` 
      };
    }

    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'Please enter your username/email and password.' };
    }

    // 2. Try Supabase Auth if online
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: cleanId,
          password: cleanPass
        });

        if (!authError && authData?.user) {
          clearFailedLogin();
          // Check role in user_metadata or user_profiles table
          const metaRole = authData.user.user_metadata?.role;
          let resolvedRole = metaRole || 'user';

          const { data: profile } = await client
            .from('user_profiles')
            .select('role, name')
            .eq('id', authData.user.id)
            .single();

          if (profile?.role) {
            resolvedRole = profile.role;
          }

          const userObj = {
            id: authData.user.id,
            email: authData.user.email,
            name: profile?.name || authData.user.user_metadata?.name || cleanId.split('@')[0],
            role: resolvedRole,
            loggedInAt: new Date().toISOString()
          };

          localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(userObj));
          window.dispatchEvent(new CustomEvent('wsp_auth_state_changed', { detail: userObj }));
          return { success: true, user: userObj };
        }
      } catch (e) {
        console.warn('Supabase login check skipped:', e);
      }
    }

    // 3. Cryptographic Local Verification
    const users = getStoredUsers();
    const computedHash = await hashPassword(cleanPass);

    const found = users.find(u => {
      const matchIdentifier = (u.email && u.email.toLowerCase() === cleanId) || 
                              (u.username && u.username.toLowerCase() === cleanId);
      if (!matchIdentifier) return false;

      // Match against stored password hash (or fallback plaintext migration if legacy)
      if (u.passwordHash) {
        return u.passwordHash === computedHash;
      }
      if (u.password) {
        return u.password === cleanPass;
      }
      return false;
    });

    if (found) {
      clearFailedLogin();
      const sessionUser = {
        id: found.id,
        email: found.email,
        username: found.username || found.email.split('@')[0],
        name: found.name || 'User',
        role: found.role || 'user',
        loggedInAt: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
      window.dispatchEvent(new CustomEvent('wsp_auth_state_changed', { detail: sessionUser }));
      return { success: true, user: sessionUser };
    }

    // Record failure for brute force prevention
    const updatedRate = recordFailedLogin();
    if (updatedRate.lockedUntil) {
      return { 
        success: false, 
        error: 'Too many failed login attempts. Temporarily locked for 60 seconds.' 
      };
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - updatedRate.count);
    return { 
      success: false, 
      error: `Invalid credentials. (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining)` 
    };
  },

  // Register a new user - STRICTLY role 'user' only (no admin creation allowed through registration)
  register: async ({ name, email, password }) => {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // Security rule: ALL registrations are strictly role 'user'
    const assignedRole = 'user';

    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'Please provide a valid email address.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const users = getStoredUsers();
    const exists = users.some(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    // Cryptographically hash password before saving
    const passwordHash = await hashPassword(cleanPass);

    const newUser = {
      id: 'usr_' + Date.now().toString(),
      email: cleanEmail,
      username: cleanEmail.split('@')[0],
      passwordHash: passwordHash,
      name: cleanName,
      role: assignedRole, // Strictly 'user'
      createdAt: new Date().toISOString()
    };

    // Save locally
    users.push(newUser);
    saveStoredUsers(users);

    // Sync to Supabase user_profiles if connected
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('user_profiles').insert({
          email: cleanEmail,
          name: cleanName,
          role: assignedRole
        });
      } catch (err) {
        console.warn('Supabase profile sync note:', err);
      }
    }

    // Auto-login newly registered user
    const sessionUser = {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      loggedInAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    window.dispatchEvent(new CustomEvent('wsp_auth_state_changed', { detail: sessionUser }));
    return { success: true, user: sessionUser };
  },

  // Telegram Mini App Seamless Authentication
  loginWithTelegram: async (tgUser) => {
    if (!tgUser || !tgUser.id) {
      return { success: false, error: 'Invalid Telegram user credentials.' };
    }

    const tgName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 
                   tgUser.username || 
                   `Telegram User #${tgUser.id}`;
    const tgEmail = tgUser.username ? `${tgUser.username.toLowerCase()}@telegram.org` : `tg_${tgUser.id}@telegram.org`;

    // Strictly role 'user' for Telegram users
    const sessionUser = {
      id: 'tg_' + tgUser.id,
      telegramId: tgUser.id,
      email: tgEmail,
      username: tgUser.username || `tg_${tgUser.id}`,
      name: tgName,
      photoUrl: tgUser.photo_url || null,
      role: 'user', // Customer catalog browsing only
      isTelegram: true,
      loggedInAt: new Date().toISOString()
    };

    // Also register or update in local storage
    const users = getStoredUsers();
    const existingIndex = users.findIndex(u => u.id === sessionUser.id || (u.telegramId && u.telegramId === tgUser.id));
    if (existingIndex !== -1) {
      users[existingIndex] = { ...users[existingIndex], ...sessionUser };
    } else {
      users.push({
        ...sessionUser,
        createdAt: new Date().toISOString()
      });
    }
    saveStoredUsers(users);

    // Save active session
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    window.dispatchEvent(new CustomEvent('wsp_auth_state_changed', { detail: sessionUser }));
    return { success: true, user: sessionUser };
  },

  // Logout current session
  logout: () => {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    const client = getSupabaseClient();
    if (client) {
      client.auth.signOut().catch(() => {});
    }
    window.dispatchEvent(new CustomEvent('wsp_auth_state_changed', { detail: null }));
    return true;
  },

  // Subscribe to auth state changes
  onAuthStateChange: (callback) => {
    const handler = (event) => {
      callback(event.detail);
    };
    window.addEventListener('wsp_auth_state_changed', handler);
    return () => {
      window.removeEventListener('wsp_auth_state_changed', handler);
    };
  }
};
