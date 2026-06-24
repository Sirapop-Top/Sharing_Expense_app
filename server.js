require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache Layer Config
const CACHE_TTL = 10000; // 10 seconds cache validity
const cache = {
  transactions: { data: null, timestamp: 0 },
  budgets: { data: null, timestamp: 0 },
  expenseTypes: { data: null, timestamp: 0 },
  settlements: { data: null, timestamp: 0 }
};

function invalidateCache() {
  cache.transactions.data = null;
  cache.budgets.data = null;
  cache.expenseTypes.data = null;
  cache.settlements.data = null;
}

// Config Endpoint
app.get('/api/config', async (req, res) => {
  try {
    const db = getDB();
    const dbConfig = await db.getConfig();
    res.json({
      user1Name: dbConfig.user1Name || process.env.USER1_NAME || "User 1",
      user2Name: dbConfig.user2Name || process.env.USER2_NAME || "User 2",
      dbMode: db.getMode()
    });
  } catch (error) {
    console.error("Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

// Update Config Endpoint (Save user names)
app.post('/api/config', async (req, res) => {
  try {
    const db = getDB();
    const { user1Name, user2Name } = req.body;
    if (!user1Name || !user2Name) {
      return res.status(400).json({ error: "user1Name and user2Name are required" });
    }
    const updated = await db.saveConfig({ user1Name: user1Name.trim(), user2Name: user2Name.trim() });
    res.json(updated);
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to save configuration" });
  }
});

// GET Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.transactions.data && (now - cache.transactions.timestamp < CACHE_TTL)) {
      return res.json(cache.transactions.data);
    }

    const db = getDB();
    const transactions = await db.getTransactions();
    
    // Sort transactions by date descending, then ID descending (newest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA - dateB !== 0) return dateB - dateA;
      return b.id.localeCompare(a.id);
    });

    cache.transactions.data = transactions;
    cache.transactions.timestamp = now;
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST Transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const db = getDB();
    const { date, paidBy, amount, expenseType, splitRatio, user1Amount, user2Amount, description, status } = req.body;
    
    if (!date || !paidBy || amount === undefined || !expenseType || !splitRatio) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newTx = {
      id: "tx_" + Math.random().toString(36).substr(2, 9),
      date,
      paidBy,
      amount: parseFloat(amount),
      expenseType,
      splitRatio,
      user1Amount: parseFloat(user1Amount),
      user2Amount: parseFloat(user2Amount),
      description: description || "",
      status: status || "Outstanding"
    };

    const saved = await db.saveTransaction(newTx);
    invalidateCache();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error saving transaction:", error);
    res.status(500).json({ error: "Failed to save transaction" });
  }
});

// PUT Transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const updated = await db.updateTransaction(id, req.body);
    invalidateCache();
    res.json(updated);
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

// DELETE Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    await db.deleteTransaction(id);
    invalidateCache();
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

// GET Budgets
app.get('/api/budgets', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.budgets.data && (now - cache.budgets.timestamp < CACHE_TTL)) {
      return res.json(cache.budgets.data);
    }

    const db = getDB();
    const budgets = await db.getBudgets();
    cache.budgets.data = budgets;
    cache.budgets.timestamp = now;
    res.json(budgets);
  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

// POST Budget
app.post('/api/budgets', async (req, res) => {
  try {
    const db = getDB();
    const { yearMonth, expenseType, budgetAmount } = req.body;

    if (!yearMonth || !expenseType || budgetAmount === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const budget = {
      yearMonth,
      expenseType,
      budgetAmount: parseFloat(budgetAmount)
    };

    const saved = await db.saveBudget(budget);
    invalidateCache();
    res.json(saved);
  } catch (error) {
    console.error("Error saving budget:", error);
    res.status(500).json({ error: "Failed to save budget" });
  }
});

// GET Expense Types (Categories)
app.get('/api/expense-types', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.expenseTypes.data && (now - cache.expenseTypes.timestamp < CACHE_TTL)) {
      return res.json(cache.expenseTypes.data);
    }

    const db = getDB();
    const types = await db.getExpenseTypes();
    cache.expenseTypes.data = types;
    cache.expenseTypes.timestamp = now;
    res.json(types);
  } catch (error) {
    console.error("Error fetching expense types:", error);
    res.status(500).json({ error: "Failed to fetch expense types" });
  }
});

// POST Expense Type
app.post('/api/expense-types', async (req, res) => {
  try {
    const db = getDB();
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const saved = await db.saveExpenseType(name.trim());
    invalidateCache();
    res.status(201).json({ name: saved });
  } catch (error) {
    console.error("Error saving expense type:", error);
    res.status(500).json({ error: "Failed to save expense type" });
  }
});

// DELETE Expense Type
app.delete('/api/expense-types/:name', async (req, res) => {
  try {
    const db = getDB();
    const { name } = req.params;
    await db.deleteExpenseType(name);
    invalidateCache();
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting expense type:", error);
    res.status(500).json({ error: "Failed to delete expense type" });
  }
});

// GET Settlements
app.get('/api/settlements', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.settlements.data && (now - cache.settlements.timestamp < CACHE_TTL)) {
      return res.json(cache.settlements.data);
    }

    const db = getDB();
    const settlements = await db.getSettlements();
    
    // Sort settlements descending by date
    settlements.sort((a, b) => new Date(b.settledDate) - new Date(a.settledDate));

    cache.settlements.data = settlements;
    cache.settlements.timestamp = now;
    res.json(settlements);
  } catch (error) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
});

// POST Settle Month (Bulk Settlement)
app.post('/api/settle-all', async (req, res) => {
  try {
    const db = getDB();
    const { yearMonth, fromUser, toUser, amount } = req.body;

    if (!yearMonth || !fromUser || !toUser || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const today = new Date().toISOString().substring(0, 10);
    const result = await db.settleMonth(yearMonth, fromUser, toUser, parseFloat(amount), today);
    invalidateCache();
    res.json(result);
  } catch (error) {
    console.error("Error running bulk settlement:", error);
    res.status(500).json({ error: "Failed to settle month" });
  }
});

// Wildcard fallback to serve index.html for UI routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Startup Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`2-Person Expense Sharing Server active!`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop`);
  console.log(`==================================================`);
});
