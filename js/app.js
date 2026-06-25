// ==========================================================================
// STATE MANAGEMENT & INITIALIZATION
// ==========================================================================
let state = {
  config: {
    user1Name: "User 1",
    user2Name: "User 2",
    dbMode: "Local Mock Database"
  },
  transactions: [],
  budgets: [],
  categories: [],
  settlements: [],
  timeframe: "monthly", // "weekly" | "monthly" | "annual"
  pickerValue: new Date().toISOString().substring(0, 7), // YYYY-MM-DD, YYYY-MM, or YYYY
  currentMonth: new Date().toISOString().substring(0, 7) // Baseline month for Budgets/Settlement page
};

// Chart references to prevent double-draw bugs
let categoryChartInstance = null;
let paidChartInstance = null;

// DOM Elements Cache
const elements = {
  // Navigation
  menuItems: document.querySelectorAll('.menu-item, .mobile-nav-item:not(.action-btn)'),
  mobileQuickAdd: document.getElementById('mobile-quick-add'),
  pageSections: document.querySelectorAll('.page-section'),
  mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
  sidebar: document.querySelector('.sidebar'),
  
  // Header / Config elements
  globalPicker: document.getElementById('global-picker'),
  dashboardTimeframe: document.getElementById('dashboard-timeframe'),
  headerDashboardControls: document.getElementById('header-dashboard-controls'),
  dbModeIndicator: document.getElementById('db-mode-indicator'),
  netBalanceAlert: document.getElementById('net-balance-alert'),
  pageTitle: document.querySelector('.top-header h1'),
  
  // Dashboard KPIs
  dashboardTotalSpent: document.getElementById('dashboard-total-spent'),
  dashboardUser1Paid: document.getElementById('dashboard-user1-paid'),
  dashboardUser1Share: document.getElementById('dashboard-user1-share'),
  dashboardUser2Paid: document.getElementById('dashboard-user2-paid'),
  dashboardUser2Share: document.getElementById('dashboard-user2-share'),
  dashboardNetSummary: document.getElementById('dashboard-net-summary'),
  user1PaidLabel: document.getElementById('user1-paid-label'),
  user2PaidLabel: document.getElementById('user2-paid-label'),
  dashboardSettleLink: document.getElementById('dashboard-settle-link'),
  manageBudgetsLink: document.getElementById('manage-budgets-link'),
  
  // Dashboard budget progress
  dashboardBudgetList: document.getElementById('dashboard-budget-list'),
  
  // Transactions Page
  filterType: document.getElementById('filter-type'),
  filterPaid: document.getElementById('filter-paid'),
  filterStatus: document.getElementById('filter-status'),
  transactionsTableBody: document.getElementById('transactions-list-tbody'),
  transactionsEmptyState: document.getElementById('transactions-empty-state'),
  quickAddBtn: document.getElementById('quick-add-btn'),
  
  // Budgets Page
  budgetActiveMonth: document.getElementById('budget-active-month'),
  budgetForm: document.getElementById('budget-form'),
  budgetCategory: document.getElementById('budget-category'),
  budgetAmount: document.getElementById('budget-amount'),
  budgetsDetailsList: document.getElementById('budgets-details-list'),
  
  // Settings Page
  categoryAddForm: document.getElementById('category-add-form'),
  categoryNewName: document.getElementById('category-new-name'),
  settingsCategoriesList: document.getElementById('settings-categories-list'),
  settlementsHistoryList: document.getElementById('settlements-history-list'),
  sysDbMode: document.getElementById('sys-db-mode'),
  sysSheetId: document.getElementById('sys-sheet-id'),
  sysUser1Name: document.getElementById('sys-user1-name'),
  sysUser2Name: document.getElementById('sys-user2-name'),
  namesUpdateForm: document.getElementById('names-update-form'),
  settingsUser1Name: document.getElementById('settings-user1-name'),
  settingsUser2Name: document.getElementById('settings-user2-name'),
  connectionUpdateForm: document.getElementById('connection-update-form'),
  settingsAppsScriptUrl: document.getElementById('settings-apps-script-url'),
  btnDisconnectAppsScript: document.getElementById('btn-disconnect-apps-script'),
  syncToast: document.getElementById('sync-toast'),
  syncToastText: document.getElementById('sync-toast-text'),
  
  // Modal Transaction
  transactionModal: document.getElementById('transaction-modal'),
  transactionForm: document.getElementById('transaction-form'),
  modalTxTitle: document.getElementById('modal-tx-title'),
  modalTxClose: document.getElementById('modal-tx-close'),
  modalTxCancel: document.getElementById('modal-tx-cancel'),
  modalTxSave: document.getElementById('modal-tx-save'),
  txId: document.getElementById('tx-id'),
  txDate: document.getElementById('tx-date'),
  txPaidBy: document.getElementById('tx-paid-by'),
  txAmount: document.getElementById('tx-amount'),
  txCategory: document.getElementById('tx-category'),
  txDesc: document.getElementById('tx-desc'),
  txSplitRatio: document.getElementById('tx-split-ratio'),
  txStatus: document.getElementById('tx-status'),
  optUser1: document.getElementById('opt-user1'),
  optUser2: document.getElementById('opt-user2'),
  customSplitFields: document.getElementById('custom-split-fields'),
  txUser1Share: document.getElementById('tx-user1-share'),
  txUser2Share: document.getElementById('tx-user2-share'),
  lblUser1Share: document.getElementById('lbl-user1-share'),
  lblUser2Share: document.getElementById('lbl-user2-share'),
  splitCalcFeedback: document.getElementById('split-calc-feedback'),
  
  // Modal Settlement
  settlementModal: document.getElementById('settlement-modal'),
  modalSettleClose: document.getElementById('modal-settle-close'),
  modalSettleCancel: document.getElementById('modal-settle-cancel'),
  modalSettleExecute: document.getElementById('modal-settle-execute'),
  settleSummaryMonth: document.getElementById('settle-summary-month'),
  settleSummaryUser1Paid: document.getElementById('settle-summary-user1-paid'),
  settleSummaryUser2Paid: document.getElementById('settle-summary-user2-paid'),
  settleMathUser1Paid: document.getElementById('settle-math-user1-paid'),
  settleMathUser2Paid: document.getElementById('settle-math-user2-paid'),
  settleMathNetTransfer: document.getElementById('settle-math-net-transfer')
};

function showSyncIndicator(message = "Syncing with Google Sheets...") {
  elements.syncToastText.textContent = message;
  elements.syncToast.style.display = 'flex';
}

function hideSyncIndicator() {
  elements.syncToast.style.display = 'none';
}

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function setupCurrencyInput(inputElement, onBlurCallback) {
  inputElement.addEventListener('focus', () => {
    const val = inputElement.value;
    if (val) {
      inputElement.value = val.replace(/,/g, '');
    }
  });
  
  inputElement.addEventListener('blur', () => {
    const val = inputElement.value;
    if (val) {
      const num = parseCurrency(val);
      inputElement.value = formatCurrency(num);
    }
    if (onBlurCallback) onBlurCallback();
  });
}

function getCategoryColorClass(categoryName) {
  if (!categoryName) return 'cat-misc';
  
  // Clean name
  const clean = categoryName.trim().toLowerCase();
  
  // Specific English and Thai mappings for standard ones
  if (clean.includes('food') || clean.includes('eat') || clean.includes('delivery') || clean.includes('takeaway') || clean.includes('cafe') || clean.includes('restaurant') || clean.includes('อาหาร') || clean.includes('กิน') || clean.includes('ข้าว') || clean.includes('สั่ง')) return 'cat-food';
  if (clean.includes('utility') || clean.includes('utilities') || clean.includes('bill') || clean.includes('internet') || clean.includes('wifi') || clean.includes('power') || clean.includes('electric') || clean.includes('water') || clean.includes('ไฟ') || clean.includes('น้ำ') || clean.includes('บิล') || clean.includes('เน็ต')) return 'cat-utilities';
  if (clean.includes('rent') || clean.includes('room') || clean.includes('apartment') || clean.includes('condo') || clean.includes('บ้าน') || clean.includes('หอ') || clean.includes('ห้อง') || clean.includes('เช่า')) return 'cat-rent';
  if (clean.includes('entertain') || clean.includes('entertainment') || clean.includes('movie') || clean.includes('game') || clean.includes('netflix') || clean.includes('shopping') || clean.includes('ช็อปปิ้ง') || clean.includes('ซื้อของ') || clean.includes('เที่ยว') || clean.includes('เล่น') || clean.includes('เกม') || clean.includes('หนัง')) return 'cat-entertainment';
  if (clean.includes('transport') || clean.includes('travel') || clean.includes('taxi') || clean.includes('grab') || clean.includes('bts') || clean.includes('mrt') || clean.includes('bus') || clean.includes('fuel') || clean.includes('gas') || clean.includes('รถ') || clean.includes('เดินทาง') || clean.includes('เรือ') || clean.includes('น้ำมัน')) return 'cat-transport';
  if (clean.includes('misc') || clean.includes('other') || clean.includes('miscellaneous') || clean.includes('อื่น') || clean.includes('ทั่วไป')) return 'cat-misc';
  
  // For any other custom categories, compute a simple hash to assign a distinct class dynamically
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % 6;
  const classes = ['cat-food', 'cat-utilities', 'cat-rent', 'cat-entertainment', 'cat-transport', 'cat-misc'];
  return classes[index];
}

// ==========================================================================
// API LAYER (HTTP Operations)
// ==========================================================================
function getDirectAppsScriptUrl() {
  return localStorage.getItem('APPS_SCRIPT_URL');
}

async function apiGet(endpoint) {
  const directUrl = getDirectAppsScriptUrl();
  if (directUrl) {
    let action = '';
    if (endpoint === '/api/config') action = 'getConfig';
    else if (endpoint === '/api/transactions') action = 'getTransactions';
    else if (endpoint === '/api/budgets') action = 'getBudgets';
    else if (endpoint === '/api/expense-types') action = 'getExpenseTypes';
    else if (endpoint === '/api/settlements') action = 'getSettlements';
    
    if (action) {
      const url = `${directUrl}${directUrl.includes('?') ? '&' : '?'}action=${action}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Apps Script GET ${action} failed`);
        const data = await res.json();
        
        if (action === 'getConfig') {
          // Add system fields returned by Node config for frontend state compat
          return {
            user1Name: data.user1Name || "Alex",
            user2Name: data.user2Name || "Sam",
            dbMode: "Google Sheets (Apps Script Direct)",
            connectionError: null
          };
        }
        if (action === 'getTransactions' && Array.isArray(data)) {
          data.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA - dateB !== 0) return dateB - dateA;
            return b.id.localeCompare(a.id);
          });
        }
        if (action === 'getSettlements' && Array.isArray(data)) {
          data.sort((a, b) => new Date(b.settledDate) - new Date(a.settledDate));
        }
        return data;
      } catch (err) {
        console.error(err);
        alert(`Apps Script Communication Error: ${err.message}`);
        return null;
      }
    }
  }

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`GET ${endpoint} failed`);
    return await res.json();
  } catch (err) {
    console.error(err);
    alert(`Server Communication Error: ${err.message}`);
    return null;
  }
}

async function apiPost(endpoint, body) {
  const directUrl = getDirectAppsScriptUrl();
  if (directUrl) {
    let payload = {};
    if (endpoint === '/api/config') {
      payload = { action: 'saveConfig', config: body };
    } else if (endpoint === '/api/transactions') {
      const newTx = {
        id: body.id || "tx_" + Math.random().toString(36).substr(2, 9),
        ...body
      };
      payload = { action: 'saveTransaction', tx: newTx };
    } else if (endpoint === '/api/budgets') {
      payload = { action: 'saveBudget', budget: body };
    } else if (endpoint === '/api/expense-types') {
      payload = { action: 'saveExpenseType', name: body.name };
    } else if (endpoint === '/api/settle-all') {
      const today = new Date().toISOString().substring(0, 10);
      payload = {
        action: 'settleMonth',
        yearMonth: body.yearMonth,
        fromUser: body.fromUser,
        toUser: body.toUser,
        amount: parseFloat(body.amount),
        date: today
      };
    }

    if (payload.action) {
      try {
        const res = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Apps Script POST ${payload.action} failed`);
        const result = await res.json();
        
        if (payload.action === 'saveTransaction') {
          return payload.tx;
        }
        if (payload.action === 'saveExpenseType') {
          return { name: payload.name };
        }
        if (payload.action === 'settleMonth') {
          return { success: result.success, count: result.count, settlement: result.settlement };
        }
        return result;
      } catch (err) {
        console.error(err);
        alert(`Apps Script POST Error: ${err.message}`);
        return null;
      }
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `POST ${endpoint} failed`);
    }
    return await res.json();
  } catch (err) {
    console.error(err);
    alert(`Submission Error: ${err.message}`);
    return null;
  }
}

async function apiPut(endpoint, body) {
  const directUrl = getDirectAppsScriptUrl();
  if (directUrl) {
    const parts = endpoint.split('/');
    const id = parts[parts.length - 1];
    const payload = {
      action: 'updateTransaction',
      id: id,
      tx: body
    };
    try {
      const res = await fetch(directUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Apps Script PUT updateTransaction failed`);
      await res.json();
      return body;
    } catch (err) {
      console.error(err);
      alert(`Apps Script PUT Error: ${err.message}`);
      return null;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${endpoint} failed`);
    return await res.json();
  } catch (err) {
    console.error(err);
    alert(`Update Error: ${err.message}`);
    return null;
  }
}

async function apiDelete(endpoint) {
  const directUrl = getDirectAppsScriptUrl();
  if (directUrl) {
    let payload = {};
    if (endpoint.startsWith('/api/transactions/')) {
      const parts = endpoint.split('/');
      const id = parts[parts.length - 1];
      payload = { action: 'deleteTransaction', id: id };
    } else if (endpoint.startsWith('/api/expense-types/')) {
      const parts = endpoint.split('/');
      const name = decodeURIComponent(parts[parts.length - 1]);
      payload = { action: 'deleteExpenseType', name: name };
    }
    
    if (payload.action) {
      try {
        const res = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Apps Script DELETE ${payload.action} failed`);
        const result = await res.json();
        return { success: result.success };
      } catch (err) {
        console.error(err);
        alert(`Apps Script DELETE Error: ${err.message}`);
        return null;
      }
    }
  }

  try {
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${endpoint} failed`);
    return await res.json();
  } catch (err) {
    console.error(err);
    alert(`Delete Error: ${err.message}`);
    return null;
  }
}

// Fetch all initial data from server
async function fetchAllData() {
  const isStaticPages = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
  const directUrl = getDirectAppsScriptUrl();
  
  if (isStaticPages && !directUrl) {
    // We are on GitHub Pages but have no Apps Script URL configured yet
    state.config = {
      user1Name: "Alex",
      user2Name: "Sam",
      dbMode: "Setup Required",
      connectionError: "Please configure your Google Apps Script URL in the Settings tab below to connect your Google Sheets database."
    };
    state.transactions = [];
    state.budgets = [];
    state.categories = ["Food", "Utilities", "Rent", "Entertainment", "Transport", "Miscellaneous"];
    state.settlements = [];
    
    updateUIElements();
    
    // Switch to Settings tab automatically to guide them
    const settingsTab = document.querySelector('.menu-item[data-target="settings"]');
    if (settingsTab) {
      // Small timeout to ensure DOM is fully loaded and initialized
      setTimeout(() => {
        settingsTab.click();
      }, 100);
    }
    
    // Show a polite helper alert explaining what to do
    setTimeout(() => {
      alert("Welcome to FairShare on GitHub Pages!\n\nTo start tracking expenses, please paste your Google Apps Script Web App URL in the input field on the Settings page and click 'Connect URL'.");
    }, 600);
    return;
  }

  if (directUrl) {
    try {
      const url = `${directUrl}${directUrl.includes('?') ? '&' : '?'}action=all`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch all data from Google Sheets Apps Script");
      const data = await res.json();
      
      if (data) {
        state.config = {
          user1Name: data.config ? data.config.user1Name : "Alex",
          user2Name: data.config ? data.config.user2Name : "Sam",
          dbMode: "Google Sheets (Apps Script Direct)",
          connectionError: null
        };
        
        state.transactions = data.transactions || [];
        state.transactions.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (dateA - dateB !== 0) return dateB - dateA;
          return b.id.localeCompare(a.id);
        });
        
        state.budgets = data.budgets || [];
        state.categories = data.expenseTypes || [];
        
        state.settlements = data.settlements || [];
        state.settlements.sort((a, b) => new Date(b.settledDate) - new Date(a.settledDate));
        
        updateUIElements();
      }
      return;
    } catch (err) {
      console.error(err);
      alert(`Apps Script Connection Error: ${err.message}`);
      return;
    }
  }

  const [config, transactions, budgets, categories, settlements] = await Promise.all([
    apiGet('/api/config'),
    apiGet('/api/transactions'),
    apiGet('/api/budgets'),
    apiGet('/api/expense-types'),
    apiGet('/api/settlements')
  ]);

  if (config) state.config = config;
  if (transactions) state.transactions = transactions;
  if (budgets) state.budgets = budgets;
  if (categories) state.categories = categories;
  if (settlements) state.settlements = settlements;

  updateUIElements();
}

// ==========================================================================
// TIME-RANGE / DATE RANGE HELPERS
// ==========================================================================

// Helper to determine the week range (Monday to Sunday) for a selected date string
function getWeekRange(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 is Sun, 1 is Mon, etc.
  const diffToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
}

// Filters transactions array by the active state timeframe configuration
function getFilteredTransactionsForDashboard() {
  const val = state.pickerValue;
  
  if (state.timeframe === 'weekly') {
    const { monday, sunday } = getWeekRange(val);
    return state.transactions.filter(t => {
      const d = new Date(t.date);
      return d >= monday && d <= sunday;
    });
  } else if (state.timeframe === 'monthly') {
    return state.transactions.filter(t => t.date.substring(0, 7) === val);
  } else if (state.timeframe === 'annual') {
    return state.transactions.filter(t => t.date.substring(0, 4) === val);
  }
  return state.transactions;
}

// ==========================================================================
// CORE CALCULATION ENGINES
// ==========================================================================

// Calculates the balance breakdown based on the dashboard range selection
function calculateTimeframeBalances() {
  const filteredTxs = getFilteredTransactionsForDashboard();
  const outstandingTxs = filteredTxs.filter(t => t.status === 'Outstanding');

  let totalSpent = 0;
  
  // Overall spending statistics
  let user1PaidTotal = 0;
  let user2PaidTotal = 0;
  let user1ShareTotal = 0;
  let user2ShareTotal = 0;

  // Net outstanding balance components
  let user1PaidOutstanding = 0;
  let user2PaidOutstanding = 0;
  let user1ShareOutstanding = 0;
  let user2ShareOutstanding = 0;

  filteredTxs.forEach(t => {
    totalSpent += t.amount;
    
    // Track cumulative paid by user
    if (t.paidBy === 'User 1') user1PaidTotal += t.amount;
    if (t.paidBy === 'User 2') user2PaidTotal += t.amount;
    
    user1ShareTotal += t.user1Amount;
    user2ShareTotal += t.user2Amount;
  });

  outstandingTxs.forEach(t => {
    if (t.paidBy === 'User 1') user1PaidOutstanding += t.amount;
    if (t.paidBy === 'User 2') user2PaidOutstanding += t.amount;
    
    user1ShareOutstanding += t.user1Amount;
    user2ShareOutstanding += t.user2Amount;
  });

  // Net Owing calculation: Paid - Share
  // If User 1 paid more than their share, User 1 is owed money
  const u1Net = user1PaidOutstanding - user1ShareOutstanding;
  
  let netText = "";
  let owesAmount = 0;
  let ower = "";
  let receiver = "";
  
  if (u1Net > 0.01) {
    owesAmount = Math.abs(u1Net);
    ower = state.config.user2Name;
    receiver = state.config.user1Name;
    netText = `${ower} owes ${receiver} ฿${formatCurrency(owesAmount)}`;
  } else if (u1Net < -0.01) {
    owesAmount = Math.abs(u1Net);
    ower = state.config.user1Name;
    receiver = state.config.user2Name;
    netText = `${ower} owes ${receiver} ฿${formatCurrency(owesAmount)}`;
  } else {
    netText = "All Settled Up!";
  }

  return {
    totalSpent,
    user1PaidTotal,
    user2PaidTotal,
    user1ShareTotal,
    user2ShareTotal,
    user1PaidOutstanding,
    user2PaidOutstanding,
    netText,
    owesAmount,
    ower,
    receiver
  };
}

// ==========================================================================
// RENDERERS & CHART PLOTTING
// ==========================================================================

function updateUIElements() {
  // Update configuration details
  elements.optUser1.textContent = state.config.user1Name;
  elements.optUser2.textContent = state.config.user2Name;
  elements.lblUser1Share.textContent = `${state.config.user1Name}'s Share (฿)`;
  elements.lblUser2Share.textContent = `${state.config.user2Name}'s Share (฿)`;
  elements.user1PaidLabel.textContent = `${state.config.user1Name} Paid`;
  elements.user2PaidLabel.textContent = `${state.config.user2Name} Paid`;
  
  // Settings detail page
  elements.sysDbMode.textContent = state.config.dbMode;
  elements.sysUser1Name.textContent = state.config.user1Name;
  elements.sysUser2Name.textContent = state.config.user2Name;
  
  // Apps Script direct connection form
  const directUrl = getDirectAppsScriptUrl();
  elements.settingsAppsScriptUrl.value = directUrl || '';
  elements.btnDisconnectAppsScript.style.display = directUrl ? 'inline-block' : 'none';
  
  // Custom display name fields in settings
  elements.settingsUser1Name.value = state.config.user1Name;
  elements.settingsUser2Name.value = state.config.user2Name;

  // DB Badge styling
  const dot = elements.dbModeIndicator.querySelector('.status-dot');
  const txt = elements.dbModeIndicator.querySelector('.mode-text');
  
  if (state.config.dbMode === "Google Sheets" || state.config.dbMode === "Google Sheets (Apps Script)" || state.config.dbMode === "Google Sheets (Apps Script Direct)") {
    txt.textContent = state.config.dbMode;
    elements.dbModeIndicator.title = "Connected to Google Sheets successfully.";
    elements.dbModeIndicator.style.cursor = 'default';
    elements.dbModeIndicator.onclick = null;
    dot.className = "status-dot green";
  } else {
    txt.textContent = state.config.dbMode;
    if (state.config.connectionError) {
      elements.dbModeIndicator.title = `Click to see details. Connection Error: ${state.config.connectionError}`;
      elements.dbModeIndicator.style.cursor = 'pointer';
      elements.dbModeIndicator.onclick = () => {
        if (state.config.dbMode === "Setup Required") {
          alert(`Google Sheets Direct Setup Required:\n\nTo connect this static application to your Google Sheet, please paste your deployed Google Apps Script Web App URL in the "Direct Google Sheets Connection" field on the Settings page, and click "Connect URL".`);
        } else {
          alert(`Google Sheets Connection Error Detail:\n\n${state.config.connectionError}\n\nTroubleshooting tips:\n1. Check that the spreadsheet ID is correct.\n2. Ensure you shared the sheet as "Editor" with the Service Account email.\n3. Make sure the private key is pasted completely and formatted correctly in Render (do not wrap in quotes inside the Render Env form).`);
        }
      };
    } else {
      elements.dbModeIndicator.title = "Running on local Mock Database fallback.";
      elements.dbModeIndicator.style.cursor = 'default';
      elements.dbModeIndicator.onclick = null;
    }
    dot.className = "status-dot amber";
  }

  // Adjust picker displays depending on active pages
  const activeTab = document.querySelector('.menu-item.active').dataset.target;
  if (activeTab === 'dashboard') {
    elements.headerDashboardControls.style.display = 'flex';
    elements.dashboardTimeframe.value = state.timeframe;
    
    if (state.timeframe === 'weekly') {
      elements.globalPicker.type = 'date';
    } else if (state.timeframe === 'monthly') {
      elements.globalPicker.type = 'month';
    } else if (state.timeframe === 'annual') {
      elements.globalPicker.type = 'number';
      elements.globalPicker.min = '2000';
      elements.globalPicker.max = '2100';
    }
    elements.globalPicker.value = state.pickerValue;
  } else {
    // Other pages filter month-by-month
    elements.headerDashboardControls.style.display = 'none';
    elements.globalPicker.type = 'month';
    elements.globalPicker.value = state.currentMonth;
  }
  
  // Formatting month names
  const activeMonthString = activeTab === 'dashboard' ? state.pickerValue.substring(0, 7) : state.currentMonth;
  const formattedMonthName = new Date(activeMonthString + "-02").toLocaleString('en-US', { month: 'long', year: 'numeric' });
  elements.budgetActiveMonth.textContent = formattedMonthName;

  // Re-fill form category selectors
  renderCategorySelectors();

  // Render Page Content
  renderDashboard();
  renderTransactionsTable();
  renderBudgetsPage();
  renderSettingsPage();
}

function renderCategorySelectors() {
  const categoryHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
  
  elements.txCategory.innerHTML = categoryHTML;
  elements.budgetCategory.innerHTML = categoryHTML;
  
  // Transactions Filter Category Selector (with 'All' option)
  elements.filterType.innerHTML = `<option value="All">All Categories</option>` + categoryHTML;
}

// Renders Page 1: Dashboard Analytics
function renderDashboard() {
  const balance = calculateTimeframeBalances();
  
  // Renders KPIs
  elements.dashboardTotalSpent.textContent = `฿${formatCurrency(balance.totalSpent)}`;
  elements.dashboardUser1Paid.textContent = `฿${formatCurrency(balance.user1PaidTotal)}`;
  elements.dashboardUser2Paid.textContent = `฿${formatCurrency(balance.user2PaidTotal)}`;
  
  elements.dashboardUser1Share.textContent = `Share: ฿${formatCurrency(balance.user1ShareTotal)}`;
  elements.dashboardUser2Share.textContent = `Share: ฿${formatCurrency(balance.user2ShareTotal)}`;
  
  // Balance status displays
  elements.dashboardNetSummary.textContent = balance.netText;

  // Header period tags
  let periodText = "Total Spending";
  let chartTitle = "Period Expense Breakdown";
  
  if (state.timeframe === 'weekly') {
    const { monday, sunday } = getWeekRange(state.pickerValue);
    const mStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    periodText = `Total Week Spending (${mStr} - ${sStr})`;
    chartTitle = "Weekly Expense Breakdown";
  } else if (state.timeframe === 'monthly') {
    const mName = new Date(state.pickerValue + "-02").toLocaleString('en-US', { month: 'long', year: 'numeric' });
    periodText = `Total Month Spending (${mName})`;
    chartTitle = "Monthly Expense Breakdown";
  } else if (state.timeframe === 'annual') {
    periodText = `Total Year Spending (${state.pickerValue})`;
    chartTitle = "Annual Expense Breakdown";
  }
  
  document.querySelector('.stat-card.gradient-primary .stat-header span').textContent = periodText;
  document.querySelector('#page-dashboard .card-title').textContent = chartTitle;

  // Net Balance Banner at the top of main panel
  if (balance.owesAmount > 0.01) {
    elements.netBalanceAlert.className = "net-balance-alert warning";
    elements.netBalanceAlert.innerHTML = `
      <i data-lucide="info"></i>
      <div><strong>Pending Settlement:</strong> ${balance.netText} for outstanding items of this period.</div>
    `;
    elements.dashboardSettleLink.style.display = "inline-block";
  } else {
    elements.netBalanceAlert.className = "net-balance-alert success";
    elements.netBalanceAlert.innerHTML = `
      <i data-lucide="check-circle"></i>
      <div><strong>Perfectly Balanced!</strong> No outstanding debts for the selected period.</div>
    `;
    elements.dashboardSettleLink.style.display = "none";
  }
  lucide.createIcons();

  // Render Charts
  drawCharts(balance);

  // Render Budgets Progress Sidebar
  renderDashboardBudgets();
}

function renderDashboardBudgets() {
  const filteredTxs = getFilteredTransactionsForDashboard();
  
  // Group spending of current period by category
  const spendingMap = {};
  state.categories.forEach(c => spendingMap[c] = 0);
  filteredTxs.forEach(t => {
    if (spendingMap[t.expenseType] !== undefined) {
      spendingMap[t.expenseType] += t.amount;
    }
  });

  // Calculate scaled / aggregated targets per timeframe
  const budgetListHTML = [];
  
  state.categories.forEach(category => {
    let limit = 0;
    let captionDetail = "";
    
    if (state.timeframe === 'weekly') {
      // Find monthly budget for current month containing the week, prorate to 7/30 days
      const monthKey = state.pickerValue.substring(0, 7);
      const b = state.budgets.find(b => b.yearMonth === monthKey && b.expenseType === category);
      limit = b ? b.budgetAmount * (7 / 30) : 0;
      captionDetail = "weekly target (7/30 pro-rata)";
    } else if (state.timeframe === 'monthly') {
      // Compare directly to month limit
      const b = state.budgets.find(b => b.yearMonth === state.pickerValue && b.expenseType === category);
      limit = b ? b.budgetAmount : 0;
      captionDetail = "monthly target limit";
    } else if (state.timeframe === 'annual') {
      // Sum all monthly budget limits for selected year
      const yearKey = state.pickerValue;
      const categoryBudgets = state.budgets.filter(b => b.yearMonth.substring(0, 4) === yearKey && b.expenseType === category);
      limit = categoryBudgets.reduce((acc, curr) => acc + curr.budgetAmount, 0);
      captionDetail = "annual target accumulation";
    }

    // Skip rendering if no budget is configured
    if (limit <= 0) return;

    const spent = spendingMap[category] || 0;
    const percent = (spent / limit) * 100;
    
    // Status color selection
    let colorClass = "success";
    let showWarning = false;
    if (percent >= 100) {
      colorClass = "danger";
      showWarning = true;
    } else if (percent >= 80) {
      colorClass = "warning";
      showWarning = true;
    }

    budgetListHTML.push(`
      <div class="budget-progress-item">
        <div class="budget-progress-header">
          <span class="budget-cat-name">
            ${showWarning ? '<i data-lucide="alert-triangle" class="budget-warning-icon"></i>' : ''}
            ${category}
          </span>
          <span class="budget-fraction">฿${formatCurrency(spent)} / ฿${formatCurrency(limit)}</span>
        </div>
        <div class="budget-bar-outer">
          <div class="budget-bar-inner ${colorClass}" style="width: ${Math.min(percent, 100)}%"></div>
        </div>
        <div class="budget-progress-header" style="margin-top: -4px;">
          <span style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">${captionDetail}</span>
          <span class="budget-percent-caption">${percent.toFixed(0)}% used</span>
        </div>
      </div>
    `);
  });

  if (budgetListHTML.length === 0) {
    elements.dashboardBudgetList.innerHTML = `
      <div class="empty-state" style="display:flex; padding:20px 0;">
        <p style="font-size:0.85rem;">No budgets configured for this period.</p>
      </div>
    `;
    return;
  }

  elements.dashboardBudgetList.innerHTML = budgetListHTML.join('');
  lucide.createIcons();
}

function drawCharts(balance) {
  const filteredTxs = getFilteredTransactionsForDashboard();
  
  // 1. Category Chart Aggregation
  const categoryTotals = {};
  state.categories.forEach(c => categoryTotals[c] = 0);
  filteredTxs.forEach(t => {
    if (categoryTotals[t.expenseType] !== undefined) {
      categoryTotals[t.expenseType] += t.amount;
    }
  });

  const categoryLabels = Object.keys(categoryTotals).filter(k => categoryTotals[k] > 0);
  const categoryData = categoryLabels.map(k => categoryTotals[k]);

  // Clean old chart
  if (categoryChartInstance) categoryChartInstance.destroy();

  if (categoryLabels.length > 0) {
    const ctx1 = document.getElementById('categoryPieChart').getContext('2d');
    categoryChartInstance = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: categoryLabels,
        datasets: [{
          data: categoryData,
          backgroundColor: [
            '#6366f1', // Indigo
            '#06b6d4', // Teal
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#ef4444', // Coral
            '#8b5cf6', // Violet
            '#ec4899'  // Pink
          ],
          borderColor: '#151c2c',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
          },
          title: {
            display: true,
            text: 'Expenses by Category',
            color: '#f3f4f6',
            font: { family: 'Outfit', size: 12 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                if (label) label += ': ';
                if (context.raw !== undefined) {
                  label += '฿' + formatCurrency(context.raw);
                }
                return label;
              }
            }
          }
        }
      }
    });
  }

  // 2. Paid By Comparison Chart
  if (paidChartInstance) paidChartInstance.destroy();

  const ctx2 = document.getElementById('paidComparisonBarChart').getContext('2d');
  paidChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: [state.config.user1Name, state.config.user2Name],
      datasets: [
        {
          label: 'Total Spent Payments',
          data: [balance.user1PaidTotal, balance.user2PaidTotal],
          backgroundColor: ['#6366f1', '#06b6d4'],
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
        y: { 
          grid: { color: 'rgba(255,255,255,0.05)' }, 
          ticks: { 
            color: '#9ca3af',
            callback: function(value) {
              return '฿' + value.toLocaleString('en-US');
            }
          } 
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Payment Distribution (Who Paid)',
          color: '#f3f4f6',
          font: { family: 'Outfit', size: 12 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.raw !== undefined) {
                label += '฿' + formatCurrency(context.raw);
              }
              return label;
            }
          }
        }
      }
    }
  });
}

// Renders Page 2: Expenses Log Table
function renderTransactionsTable() {
  const typeFilter = elements.filterType.value;
  const userFilter = elements.filterPaid.value;
  const statusFilter = elements.filterStatus.value;

  // Filter current active month transactions
  let txs = state.transactions.filter(t => t.date.substring(0, 7) === state.currentMonth);

  // Apply selectors
  if (typeFilter !== 'All') {
    txs = txs.filter(t => t.expenseType === typeFilter);
  }
  if (userFilter !== 'All') {
    const userKey = userFilter === 'User 1' ? 'User 1' : 'User 2';
    txs = txs.filter(t => t.paidBy === userKey);
  }
  if (statusFilter !== 'All') {
    txs = txs.filter(t => t.status === statusFilter);
  }

  if (txs.length === 0) {
    elements.transactionsTableBody.innerHTML = '';
    elements.transactionsEmptyState.style.display = 'flex';
    return;
  }

  elements.transactionsEmptyState.style.display = 'none';

  const rows = txs.map(t => {
    const paidByName = t.paidBy === 'User 1' ? state.config.user1Name : state.config.user2Name;
    const splitText = t.splitRatio === '50:50' 
      ? `Split 50:50` 
      : `${state.config.user1Name}: ฿${formatCurrency(t.user1Amount)}<br>${state.config.user2Name}: ฿${formatCurrency(t.user2Amount)}`;

    let statusClass = "outstanding";
    if (t.status === 'Settled') statusClass = "settled";
    if (t.status === 'Tread') statusClass = "tread";

    return `
      <tr data-id="${t.id}">
        <td data-label="Date" class="tx-date-col">${t.date}</td>
        <td data-label="Description" class="tx-desc-col" title="${t.description}">${t.description || '-'}</td>
        <td data-label="Category"><span class="cat-badge ${getCategoryColorClass(t.expenseType)}">${t.expenseType}</span></td>
        <td data-label="Paid By" style="font-weight:600;">${paidByName}</td>
        <td data-label="Amount" class="tx-amount-col">฿${formatCurrency(t.amount)}</td>
        <td data-label="Split" class="tx-split-col">${splitText}</td>
        <td data-label="Status"><span class="status-badge ${statusClass}">${t.status}</span></td>
        <td class="tx-actions-col">
          <div class="actions-cell">
            <button class="btn-action-icon edit-tx-btn" title="Edit"><i data-lucide="edit-2"></i></button>
            <button class="btn-action-icon delete delete-tx-btn" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  elements.transactionsTableBody.innerHTML = rows;
  lucide.createIcons();

  // Attach button triggers
  document.querySelectorAll('.edit-tx-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      openTxModal(row.dataset.id);
    });
  });

  document.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const id = row.dataset.id;
      const tx = state.transactions.find(t => t.id === id);
      if (confirm(`Are you sure you want to delete this expense for "${tx.description}" (฿${formatCurrency(tx.amount)})?`)) {
        // Optimistic UI update
        state.transactions = state.transactions.filter(t => t.id !== id);
        updateUIElements();
        
        showSyncIndicator("Deleting expense from Google Sheets...");
        
        apiDelete(`/api/transactions/${id}`).then(() => {
          hideSyncIndicator();
          fetchAllData(); // Refresh list to ensure perfect sync
        }).catch(err => {
          console.error(err);
          alert("Failed to delete transaction. Re-fetching data...");
          hideSyncIndicator();
          fetchAllData();
        });
      }
    });
  });
}

// Renders Page 3: Budgets configuration panel
function renderBudgetsPage() {
  const monthBudgets = state.budgets.filter(b => b.yearMonth === state.currentMonth);
  const activeMonthTxs = state.transactions.filter(t => t.date.substring(0, 7) === state.currentMonth);

  // Spend Map
  const spendMap = {};
  state.categories.forEach(c => spendMap[c] = 0);
  activeMonthTxs.forEach(t => {
    if (spendMap[t.expenseType] !== undefined) {
      spendMap[t.expenseType] += t.amount;
    }
  });

  if (monthBudgets.length === 0) {
    elements.budgetsDetailsList.innerHTML = `
      <div class="empty-state" style="display:flex;">
        <i data-lucide="wallet"></i>
        <p>No budgets saved for this month yet. Use the limit form to establish one.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const cards = monthBudgets.map(b => {
    const spent = spendMap[b.expenseType] || 0;
    const isExceeded = spent > b.budgetAmount;
    
    return `
      <div class="budget-viewer-card ${isExceeded ? 'border-danger' : ''}">
        <div class="budget-info-left">
          <span class="cat-badge ${getCategoryColorClass(b.expenseType)}">${b.expenseType}</span>
          <span class="limit">Limit: ฿${formatCurrency(b.budgetAmount)}</span>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700; color: ${isExceeded ? 'var(--color-danger)' : 'var(--color-success)'}">
            Spent: ฿${formatCurrency(spent)}
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted)">
            ${isExceeded ? 'Exceeded Limit!' : 'Within Budget'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  elements.budgetsDetailsList.innerHTML = cards;
}

// Renders Page 4: Settings (Categories, Settlement history & Logs)
function renderSettingsPage() {
  // 1. Categories List
  const catItems = state.categories.map(c => `
    <li>
      <span class="cat-badge ${getCategoryColorClass(c)}">${c}</span>
      <button class="btn-action-icon delete delete-cat-btn" data-cat="${c}" title="Delete Category">
        <i data-lucide="trash-2"></i>
      </button>
    </li>
  `).join('');
  elements.settingsCategoriesList.innerHTML = catItems;
  lucide.createIcons();

  // Attach delete triggers
  document.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const btnEl = e.target.closest('button');
      const categoryName = btnEl.dataset.cat;
      
      // Safety check: is it in use?
      const inUse = state.transactions.some(t => t.expenseType === categoryName);
      if (inUse) {
        alert(`Cannot delete "${categoryName}" category because active transactions are logged under it! Please modify those transactions first.`);
        return;
      }

      if (confirm(`Remove the expense category "${categoryName}"? This will modify settings in the Google Sheet instantly.`)) {
        await apiDelete(`/api/expense-types/${encodeURIComponent(categoryName)}`);
        await fetchAllData();
      }
    });
  });

  // 2. Settlements Logs
  if (state.settlements.length === 0) {
    elements.settlementsHistoryList.innerHTML = `
      <p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding: 20px 0;">
        No settlement history recorded yet.
      </p>
    `;
    return;
  }

  const logs = state.settlements.map(s => {
    const fromName = s.fromUser === 'User 1' ? state.config.user1Name : state.config.user2Name;
    const toName = s.toUser === 'User 1' ? state.config.user1Name : state.config.user2Name;
    const monthFormatted = new Date(s.yearMonth + "-02").toLocaleString('en-US', { month: 'long', year: 'numeric' });

    return `
      <div class="settlement-log-card">
        <div class="settlement-log-header">
          <span>Date: ${s.settledDate}</span>
          <span>Scope: ${monthFormatted}</span>
        </div>
        <div class="settlement-log-body">
          <i data-lucide="check-circle-2"></i>
          <span>${fromName} paid <strong class="amount">฿${formatCurrency(s.amount)}</strong> to ${toName}</span>
        </div>
      </div>
    `;
  }).join('');
  
  elements.settlementsHistoryList.innerHTML = logs;
  lucide.createIcons();
}

// ==========================================================================
// MODALS LOGIC (Forms & Splits Calculation)
// ==========================================================================

function openTxModal(editId = null) {
  // Re-verify category dropdowns
  renderCategorySelectors();

  if (editId) {
    elements.modalTxTitle.textContent = "Edit Expense";
    const tx = state.transactions.find(t => t.id === editId);
    
    elements.txId.value = tx.id;
    elements.txDate.value = tx.date;
    elements.txPaidBy.value = tx.paidBy;
    elements.txAmount.value = formatCurrency(tx.amount);
    elements.txCategory.value = tx.expenseType;
    elements.txDesc.value = tx.description || "";
    elements.txSplitRatio.value = tx.splitRatio;
    elements.txStatus.value = tx.status;
    
    if (tx.splitRatio === 'Custom') {
      elements.customSplitFields.style.display = 'block';
      elements.txUser1Share.value = formatCurrency(tx.user1Amount);
      elements.txUser2Share.value = formatCurrency(tx.user2Amount);
    } else {
      elements.customSplitFields.style.display = 'none';
      elements.txUser1Share.value = '';
      elements.txUser2Share.value = '';
    }
  } else {
    elements.modalTxTitle.textContent = "Log Expense";
    elements.txId.value = "";
    elements.txDate.value = new Date().toISOString().substring(0, 10);
    elements.txPaidBy.value = "User 1";
    elements.txAmount.value = "";
    elements.txCategory.value = state.categories[0] || "";
    elements.txDesc.value = "";
    elements.txSplitRatio.value = "50:50";
    elements.txStatus.value = "Outstanding";
    
    elements.customSplitFields.style.display = 'none';
    elements.txUser1Share.value = '';
    elements.txUser2Share.value = '';
  }

  validateCustomSplit(); // Reset checks
  elements.transactionModal.classList.add('active');
}

function closeTxModal() {
  elements.transactionModal.classList.remove('active');
  elements.transactionForm.reset();
}
// Auto-Split Calculation engine
function handleAmountOrSplitChange() {
  const amount = parseCurrency(elements.txAmount.value);
  const splitStrategy = elements.txSplitRatio.value;

  if (splitStrategy === '50:50') {
    elements.customSplitFields.style.display = 'none';
    elements.txUser1Share.value = formatCurrency(amount / 2);
    elements.txUser2Share.value = formatCurrency(amount / 2);
    elements.modalTxSave.disabled = false;
    elements.splitCalcFeedback.style.display = 'none';
  } else {
    elements.customSplitFields.style.display = 'block';
    // Do not override user custom values if already entered
    if (!elements.txUser1Share.value && !elements.txUser2Share.value) {
      elements.txUser1Share.value = formatCurrency(amount / 2);
      elements.txUser2Share.value = formatCurrency(amount / 2);
    }
    validateCustomSplit();
  }
}

// Custom split fields real-time validator
function validateCustomSplit() {
  if (elements.txSplitRatio.value !== 'Custom') return;

  const total = parseCurrency(elements.txAmount.value);
  const u1Share = parseCurrency(elements.txUser1Share.value);
  const u2Share = parseCurrency(elements.txUser2Share.value);

  const diff = Math.abs((u1Share + u2Share) - total);
  
  // Standard floating point margin checks
  if (diff > 0.01) {
    elements.splitCalcFeedback.style.display = 'block';
    elements.splitCalcFeedback.textContent = `Sum of shares (฿${formatCurrency(u1Share + u2Share)}) must equal total amount (฿${formatCurrency(total)}). Current diff: ฿${formatCurrency(diff)}`;
    elements.modalTxSave.disabled = true;
  } else {
    elements.splitCalcFeedback.style.display = 'none';
    elements.modalTxSave.disabled = false;
  }
}

// Settlement calculation modal
function openSettlementModal() {
  const balance = calculateTimeframeBalances();
  const formattedMonthName = new Date(state.currentMonth + "-02").toLocaleString('en-US', { month: 'long', year: 'numeric' });
  
  elements.settleSummaryMonth.textContent = formattedMonthName;
  elements.settleSummaryUser1Paid.textContent = `${state.config.user1Name} Paid (Outstanding)`;
  elements.settleSummaryUser2Paid.textContent = `${state.config.user2Name} Paid (Outstanding)`;
  
  elements.settleMathUser1Paid.textContent = `฿${formatCurrency(balance.user1PaidOutstanding)}`;
  elements.settleMathUser2Paid.textContent = `฿${formatCurrency(balance.user2PaidOutstanding)}`;

  if (balance.owesAmount <= 0.01) {
    elements.settleMathNetTransfer.textContent = "No outstanding balance";
    elements.modalSettleExecute.disabled = true;
  } else {
    elements.settleMathNetTransfer.textContent = balance.netText;
    elements.modalSettleExecute.disabled = false;
    
    // Store variables to invoke settle API
    elements.modalSettleExecute.dataset.amount = balance.owesAmount;
    elements.modalSettleExecute.dataset.from = balance.ower === state.config.user1Name ? 'User 1' : 'User 2';
    elements.modalSettleExecute.dataset.to = balance.receiver === state.config.user1Name ? 'User 1' : 'User 2';
  }

  elements.settlementModal.classList.add('active');
}

// Handler when dashboard timeframe selection is modified
function handleTimeframeChange() {
  const tf = elements.dashboardTimeframe.value;
  state.timeframe = tf;

  // Adjust picker types dynamically
  if (tf === 'weekly') {
    elements.globalPicker.type = 'date';
    if (state.pickerValue.length !== 10) {
      state.pickerValue = new Date().toISOString().substring(0, 10);
    }
  } else if (tf === 'monthly') {
    elements.globalPicker.type = 'month';
    if (state.pickerValue.length !== 7) {
      state.pickerValue = new Date().toISOString().substring(0, 7);
    }
  } else if (tf === 'annual') {
    elements.globalPicker.type = 'number';
    elements.globalPicker.min = '2000';
    elements.globalPicker.max = '2100';
    if (state.pickerValue.length !== 4) {
      state.pickerValue = new Date().toISOString().substring(0, 4);
    }
  }
  
  elements.globalPicker.value = state.pickerValue;
  renderDashboard();
}

function closeSettlementModal() {
  elements.settlementModal.classList.remove('active');
}

// ==========================================================================
// EVENT LISTENERS & NAVIGATION
// ==========================================================================

function initEventListeners() {
  // Navigation tabs switches
  // Navigation tabs switches
  elements.menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.target;
      
      elements.menuItems.forEach(i => {
        if (i.dataset.target === target) {
          i.classList.add('active');
        } else {
          i.classList.remove('active');
        }
      });

      const labelEl = item.querySelector('span');
      if (labelEl) {
        elements.pageTitle.textContent = labelEl.textContent;
      } else {
        elements.pageTitle.textContent = target.charAt(0).toUpperCase() + target.slice(1);
      }

      elements.pageSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `page-${target}`) {
          section.classList.add('active');
        }
      });

      // Sync date formats
      if (target === 'dashboard') {
        elements.headerDashboardControls.style.display = 'flex';
        handleTimeframeChange();
      } else {
        elements.headerDashboardControls.style.display = 'none';
        elements.globalPicker.type = 'month';
        elements.globalPicker.value = state.currentMonth;
      }

      updateUIElements();

      // Auto close sidebar on mobile
      if (window.innerWidth <= 768) {
        elements.sidebar.classList.remove('active');
      }
    });
  });

  // Mobile floating quick add button
  if (elements.mobileQuickAdd) {
    elements.mobileQuickAdd.addEventListener('click', (e) => {
      e.preventDefault();
      openTxModal();
    });
  }

  // Mobile sidebar toggle
  elements.mobileSidebarToggle.addEventListener('click', () => {
    elements.sidebar.classList.toggle('active');
  });

  // Mobile chart tabs toggle behavior
  const categoryTab = document.querySelector('.chart-tab[data-chart="category"]');
  const paidTab = document.querySelector('.chart-tab[data-chart="paid"]');
  const chartsContainer = document.querySelector('.charts-container');
  
  if (categoryTab && paidTab && chartsContainer) {
    categoryTab.addEventListener('click', (e) => {
      e.preventDefault();
      categoryTab.classList.add('active');
      paidTab.classList.remove('active');
      chartsContainer.classList.remove('show-paid');
      chartsContainer.classList.add('show-category');
    });
    
    paidTab.addEventListener('click', (e) => {
      e.preventDefault();
      paidTab.classList.add('active');
      categoryTab.classList.remove('active');
      chartsContainer.classList.remove('show-category');
      chartsContainer.classList.add('show-paid');
    });
  }

  // Dashboard specific timeframe filter
  elements.dashboardTimeframe.addEventListener('change', handleTimeframeChange);

  // Dynamic date picker value change handler
  elements.globalPicker.addEventListener('change', (e) => {
    const val = e.target.value;
    const activeTab = document.querySelector('.menu-item.active').dataset.target;
    
    if (activeTab === 'dashboard') {
      state.pickerValue = val;
      renderDashboard();
    } else {
      state.currentMonth = val;
      fetchAllData();
    }
  });

  // Trigger modals
  elements.quickAddBtn.addEventListener('click', () => openTxModal());
  elements.modalTxClose.addEventListener('click', closeTxModal);
  elements.modalTxCancel.addEventListener('click', closeTxModal);
  elements.dashboardSettleLink.addEventListener('click', openSettlementModal);
  elements.modalSettleClose.addEventListener('click', closeSettlementModal);
  elements.modalSettleCancel.addEventListener('click', closeSettlementModal);
  
  // Dashboard budget shortcut redirects
  elements.manageBudgetsLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.menu-item[data-target="budgets"]').click();
  });

  // Setup focus and blur behaviors for currency inputs
  setupCurrencyInput(elements.txAmount, handleAmountOrSplitChange);
  setupCurrencyInput(elements.txUser1Share, validateCustomSplit);
  setupCurrencyInput(elements.txUser2Share, validateCustomSplit);
  setupCurrencyInput(elements.budgetAmount);

  // Transaction form change calculations
  elements.txAmount.addEventListener('input', handleAmountOrSplitChange);
  elements.txSplitRatio.addEventListener('change', handleAmountOrSplitChange);
  elements.txUser1Share.addEventListener('input', validateCustomSplit);
  elements.txUser2Share.addEventListener('input', validateCustomSplit);

  // Transactions Filter Triggers
  elements.filterType.addEventListener('change', renderTransactionsTable);
  elements.filterPaid.addEventListener('change', renderTransactionsTable);
  elements.filterStatus.addEventListener('change', renderTransactionsTable);

  // Submit User Name Settings Customizations form
  elements.namesUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u1 = elements.settingsUser1Name.value.trim();
    const u2 = elements.settingsUser2Name.value.trim();
    if (!u1 || !u2) return;

    const saved = await apiPost('/api/config', { user1Name: u1, user2Name: u2 });
    if (saved) {
      await fetchAllData();
      alert("Display names updated successfully!");
    }
  });

  // Submit log form (Create/Update with Optimistic UI updates)
  elements.transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = elements.txId.value;
    const splitRatio = elements.txSplitRatio.value;
    const amount = parseCurrency(elements.txAmount.value);
    
    let user1Amount, user2Amount;
    if (splitRatio === '50:50') {
      user1Amount = amount / 2;
      user2Amount = amount / 2;
    } else {
      user1Amount = parseCurrency(elements.txUser1Share.value);
      user2Amount = parseCurrency(elements.txUser2Share.value);
    }

    const payload = {
      date: elements.txDate.value,
      paidBy: elements.txPaidBy.value,
      amount,
      expenseType: elements.txCategory.value,
      splitRatio,
      user1Amount,
      user2Amount,
      description: elements.txDesc.value.trim(),
      status: elements.txStatus.value
    };

    // Close modal immediately for 0ms perceived latency
    closeTxModal();

    if (id) {
      // Optimistic edit
      const index = state.transactions.findIndex(t => t.id === id);
      if (index !== -1) {
        state.transactions[index] = { ...state.transactions[index], ...payload };
        updateUIElements();
      }
      
      showSyncIndicator("Saving changes to Google Sheets...");
      
      apiPut(`/api/transactions/${id}`, payload).then(() => {
        hideSyncIndicator();
        fetchAllData(); // Silently reload to ensure perfect sync
      }).catch(err => {
        console.error(err);
        alert("Failed to save changes. Re-fetching data...");
        hideSyncIndicator();
        fetchAllData();
      });
    } else {
      // Optimistic create
      const tempId = "tx_temp_" + Math.random().toString(36).substr(2, 9);
      const optimisticTx = {
        id: tempId,
        ...payload
      };
      state.transactions.unshift(optimisticTx);
      updateUIElements();
      
      showSyncIndicator("Adding expense to Google Sheets...");
      
      apiPost('/api/transactions', payload).then(saved => {
        hideSyncIndicator();
        // Replace temp transaction with actual saved one
        const index = state.transactions.findIndex(t => t.id === tempId);
        if (index !== -1 && saved) {
          state.transactions[index] = saved;
        }
        fetchAllData();
      }).catch(err => {
        console.error(err);
        alert("Failed to add transaction. Re-fetching data...");
        hideSyncIndicator();
        fetchAllData();
      });
    }
  });

  // Submit budget form
  elements.budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      yearMonth: state.currentMonth,
      expenseType: elements.budgetCategory.value,
      budgetAmount: parseCurrency(elements.budgetAmount.value)
    };

    await apiPost('/api/budgets', payload);
    elements.budgetAmount.value = '';
    await fetchAllData();
  });

  // Submit settings custom category form
  elements.categoryAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoryName = elements.categoryNewName.value.trim();
    if (!categoryName) return;

    if (state.categories.map(c => c.toLowerCase()).includes(categoryName.toLowerCase())) {
      alert(`The category "${categoryName}" already exists.`);
      return;
    }

    await apiPost('/api/expense-types', { name: categoryName });
    elements.categoryNewName.value = '';
    await fetchAllData();
  });

  // Execute Month-End bulk settlement
  elements.modalSettleExecute.addEventListener('click', async (e) => {
    const dataset = e.target.dataset;
    const payload = {
      yearMonth: state.currentMonth,
      fromUser: dataset.from,
      toUser: dataset.to,
      amount: parseFloat(dataset.amount)
    };

    await apiPost('/api/settle-all', payload);
    closeSettlementModal();
    await fetchAllData();
  });

  // Submit Google Apps Script direct connection form
  elements.connectionUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = elements.settingsAppsScriptUrl.value.trim();
    if (!url) return;
    
    if (!url.startsWith('https://script.google.com/')) {
      alert('Invalid URL. The Google Apps Script URL must start with "https://script.google.com/"');
      return;
    }
    
    localStorage.setItem('APPS_SCRIPT_URL', url);
    alert('Connected directly to Google Sheets via Apps Script! Refreshing data...');
    await fetchAllData();
  });

  // Disconnect Google Apps Script
  elements.btnDisconnectAppsScript.addEventListener('click', async () => {
    if (confirm('Are you sure you want to disconnect from direct Google Sheet connection and fall back to local server APIs?')) {
      localStorage.removeItem('APPS_SCRIPT_URL');
      elements.settingsAppsScriptUrl.value = '';
      alert('Disconnected. Refreshing data...');
      await fetchAllData();
    }
  });
}

// ==========================================================================
// RUN APPLICATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  fetchAllData();
});
