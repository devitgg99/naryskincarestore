export const PERIOD_MODES = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  DATE: 'date',
  RANGE: 'range',
  ALL: 'all',
};

export const STATUS_FILTERS = {
  ALL: 'all',
  UNPAID: 'unpaid',
  PAID: 'paid',
};

/**
 * Formats a Date or timestamp string into a local YYYY-MM-DD key
 * (avoids UTC day-shift bugs after midnight in local timezones).
 */
export const toLocalDateKey = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a Date or timestamp string into a local YYYY-MM key.
 */
export const toLocalMonthKey = (value) => {
  const key = toLocalDateKey(value);
  return key ? key.slice(0, 7) : '';
};

/**
 * Parses a local YYYY-MM-DD key into a Date at local midnight (or null if invalid).
 */
export const parseLocalDateKey = (dateKey) => {
  if (!dateKey || typeof dateKey !== 'string') return null;
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Shifts a YYYY-MM month key by `delta` months (e.g. -1 for previous month).
 */
export const shiftMonthKey = (monthKey, delta) => {
  const [year, month] = (monthKey || toLocalMonthKey(new Date())).split('-').map(Number);
  const d = new Date(year, (month - 1) + delta, 1);
  return toLocalMonthKey(d);
};

/**
 * Computes local start (Monday 00:00:00.000) and end (Sunday 23:59:59.999)
 * for the week containing `now` shifted by `weekOffset` weeks.
 */
export const getWeekDateRange = (now = new Date(), weekOffset = 0) => {
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7);
  const dayOffsetFromMonday = (anchor.getDay() + 6) % 7;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - dayOffsetFromMonday, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
};

export const getOrderTimestamp = (order) => order?.ordered_at || order?.created_at || null;

export const isOrderPaid = (order) => String(order?.status || '').trim().toLowerCase() === 'paid';

export const isOrderInPeriod = (
  order,
  { periodMode, dateFilter, monthFilter, weekOffset = 0, rangeStart, rangeEnd, now = new Date() }
) => {
  if (periodMode === PERIOD_MODES.ALL) return true;

  const rawDate = getOrderTimestamp(order);
  if (!rawDate) return false;
  const orderDate = new Date(rawDate);
  if (Number.isNaN(orderDate.getTime())) return false;

  if (periodMode === PERIOD_MODES.TODAY) {
    return toLocalDateKey(orderDate) === toLocalDateKey(now);
  }
  if (periodMode === PERIOD_MODES.WEEK) {
    const { start, end } = getWeekDateRange(now, weekOffset);
    return orderDate >= start && orderDate <= end;
  }
  if (periodMode === PERIOD_MODES.MONTH) {
    const targetMonth = monthFilter || toLocalMonthKey(now);
    return toLocalMonthKey(orderDate) === targetMonth;
  }
  if (periodMode === PERIOD_MODES.DATE) {
    if (!dateFilter) return true;
    return toLocalDateKey(orderDate) === dateFilter;
  }
  if (periodMode === PERIOD_MODES.RANGE) {
    const startDate = parseLocalDateKey(rangeStart);
    const endDateStart = parseLocalDateKey(rangeEnd);
    const endDate = endDateStart
      ? new Date(endDateStart.getFullYear(), endDateStart.getMonth(), endDateStart.getDate(), 23, 59, 59, 999)
      : null;
    if (startDate && orderDate < startDate) return false;
    if (endDate && orderDate > endDate) return false;
    return true;
  }
  return true;
};

export const getPeriodLabel = ({ periodMode, dateFilter, monthFilter, weekOffset = 0, rangeStart, rangeEnd }) => {
  switch (periodMode) {
    case PERIOD_MODES.TODAY:
      return 'Today';
    case PERIOD_MODES.WEEK: {
      if (weekOffset === 0) return 'This Week';
      const { start, end } = getWeekDateRange(new Date(), weekOffset);
      const fmt = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `Week (${fmt(start)} – ${fmt(end)})`;
    }
    case PERIOD_MODES.MONTH:
      return monthFilter ? `Month (${monthFilter})` : 'This Month';
    case PERIOD_MODES.DATE:
      return dateFilter ? `Date (${dateFilter})` : 'Selected Date';
    case PERIOD_MODES.RANGE:
      if (rangeStart && rangeEnd) return `${rangeStart} → ${rangeEnd}`;
      if (rangeStart) return `From ${rangeStart}`;
      if (rangeEnd) return `Until ${rangeEnd}`;
      return 'Custom Range';
    case PERIOD_MODES.ALL:
    default:
      return 'All Time';
  }
};

export const resolveOrderCustomer = (order, customers = []) => {
  if (!order) return null;
  const targetId = String(order.customer_id || '').trim().toLowerCase();
  if (targetId) {
    const match = customers.find((c) => String(c.id).trim().toLowerCase() === targetId);
    if (match) return match;
  }
  return order.customer || order.customers || null;
};

export const getOrderTotalProfit = (items = [], getItemCost) => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, oi) => {
    if (!oi.product_id) return sum;
    const cost = typeof getItemCost === 'function' ? getItemCost(oi) : Number(oi.supplier_price || 0);
    const selling = Number(oi.unit_price || 0);
    const qty = Number(oi.quantity || 0);
    return sum + (selling - cost) * qty;
  }, 0);
};
