// Telegram Mini App (TMA) Integration Service
// Provides seamless detection, user retrieval, viewport management, theme synchronization, and haptics

export const getTelegram = () => {
  if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

// Check if running inside Telegram Mini App
export const isTelegramMiniApp = () => {
  const tg = getTelegram();
  if (!tg) return false;
  // In Telegram, initData is present or platform is defined and not unknown
  return Boolean(tg.initData && tg.initData.length > 0) || Boolean(tg.initDataUnsafe?.user) || (tg.platform && tg.platform !== 'unknown');
};

// Get current Telegram user profile if launched from Telegram
export const getTelegramUser = () => {
  const tg = getTelegram();
  if (!tg || !tg.initDataUnsafe) return null;
  return tg.initDataUnsafe.user || null;
};

// Initialize Telegram Mini App viewport & theme
export const initTelegramMiniApp = ({ onThemeChange } = {}) => {
  const tg = getTelegram();
  if (!tg) return null;

  try {
    // Notify Telegram that the Mini App is ready
    tg.ready();

    // Expand to full screen height
    tg.expand();

    // Enable closing confirmation to prevent accidental swipe-down exits
    if (typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation();
    }

    // Set Telegram header and background colors matching design system
    if (typeof tg.setHeaderColor === 'function') {
      tg.setHeaderColor('#000080');
    }
    if (typeof tg.setBackgroundColor === 'function') {
      const bg = tg.colorScheme === 'dark' ? '#0a0d14' : '#ffffff';
      tg.setBackgroundColor(bg);
    }

    // Listen to Telegram theme changes (light/dark mode toggle inside Telegram)
    if (onThemeChange && typeof tg.onEvent === 'function') {
      tg.onEvent('themeChanged', () => {
        onThemeChange(tg.colorScheme || 'light');
      });
    }

    return {
      user: tg.initDataUnsafe?.user || null,
      colorScheme: tg.colorScheme || 'light',
      platform: tg.platform || 'web'
    };
  } catch (err) {
    console.warn('Telegram WebApp init warning:', err);
    return null;
  }
};

// Trigger light haptic impact (useful when clicking product cards or buttons)
export const telegramHaptic = (type = 'light') => {
  const tg = getTelegram();
  if (tg?.HapticFeedback?.impactOccurred) {
    try {
      tg.HapticFeedback.impactOccurred(type);
    } catch {
      // Ignore if not supported on client
    }
  }
};

// Trigger notification feedback (success, error, warning)
export const telegramNotification = (type = 'success') => {
  const tg = getTelegram();
  if (tg?.HapticFeedback?.notificationOccurred) {
    try {
      tg.HapticFeedback.notificationOccurred(type);
    } catch {
      // Ignore
    }
  }
};

// Control Telegram native BackButton
export const setTelegramBackButton = (show, onClick) => {
  const tg = getTelegram();
  if (!tg || !tg.BackButton) return;

  try {
    if (show) {
      tg.BackButton.show();
      if (onClick) {
        tg.BackButton.onClick(onClick);
      }
    } else {
      tg.BackButton.hide();
    }
  } catch {
    // Ignore
  }
};

// Control Telegram native MainButton
export const setTelegramMainButton = ({ text, show = true, onClick, color = '#000080' }) => {
  const tg = getTelegram();
  if (!tg || !tg.MainButton) return;

  try {
    if (text) tg.MainButton.setText(text);
    tg.MainButton.setParams({
      color: color,
      text_color: '#ffffff'
    });
    if (onClick) {
      tg.MainButton.onClick(onClick);
    }
    if (show) {
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
  } catch {
    // Ignore
  }
};
