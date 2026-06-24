const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Path for local database fallback
const MOCK_DB_DIR = path.join(__dirname, 'data');
const MOCK_DB_FILE = path.join(MOCK_DB_DIR, 'db.json');

// Initialize local mock DB with sample data if it doesn't exist
function initMockDb() {
  if (!fs.existsSync(MOCK_DB_DIR)) {
    fs.mkdirSync(MOCK_DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(MOCK_DB_FILE)) {
    const currentMonth = new Date().toISOString().substring(0, 7); // e.g., '2026-06'
    const today = new Date().toISOString().substring(0, 10);
    
    const initialData = {
      config: {
        user1Name: process.env.USER1_NAME || "Alex",
        user2Name: process.env.USER2_NAME || "Sam"
      },
      expenseTypes: ["Food", "Utilities", "Rent", "Entertainment", "Transport", "Miscellaneous"],
      budgets: [
        { yearMonth: currentMonth, expenseType: "Food", budgetAmount: 400 },
        { yearMonth: currentMonth, expenseType: "Utilities", budgetAmount: 150 },
        { yearMonth: currentMonth, expenseType: "Rent", budgetAmount: 1200 },
        { yearMonth: currentMonth, expenseType: "Entertainment", budgetAmount: 200 }
      ],
      transactions: [
        {
          id: "tx_" + Math.random().toString(36).substr(2, 9),
          date: today,
          paidBy: "User 1",
          amount: 1000,
          expenseType: "Rent",
          splitRatio: "50:50",
          user1Amount: 500,
          user2Amount: 500,
          description: "Monthly apartment rent payment",
          status: "Outstanding"
        },
        {
          id: "tx_" + Math.random().toString(36).substr(2, 9),
          date: today,
          paidBy: "User 2",
          amount: 120,
          expenseType: "Food",
          splitRatio: "50:50",
          user1Amount: 60,
          user2Amount: 60,
          description: "Weekly grocery run at supermarkets",
          status: "Outstanding"
        },
        {
          id: "tx_" + Math.random().toString(36).substr(2, 9),
          date: today,
          paidBy: "User 1",
          amount: 80,
          expenseType: "Utilities",
          splitRatio: "Custom",
          user1Amount: 30,
          user2Amount: 50,
          description: "Electricity bill (custom split ratio)",
          status: "Outstanding"
        }
      ],
      settlements: []
    };
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// ----------------------------------------------------
// Mock JSON Database Adapter
// ----------------------------------------------------
class MockDatabaseAdapter {
  constructor() {
    initMockDb();
  }

  async read() {
    initMockDb();
    const data = fs.readFileSync(MOCK_DB_FILE, 'utf8');
    return JSON.parse(data);
  }

  async write(data) {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  async getExpenseTypes() {
    const data = await this.read();
    return data.expenseTypes || [];
  }

  async saveExpenseType(name) {
    const data = await this.read();
    if (!data.expenseTypes.includes(name)) {
      data.expenseTypes.push(name);
      await this.write(data);
    }
    return name;
  }

  async deleteExpenseType(name) {
    const data = await this.read();
    data.expenseTypes = data.expenseTypes.filter(t => t !== name);
    await this.write(data);
    return true;
  }

  async getTransactions() {
    const data = await this.read();
    return data.transactions || [];
  }

  async saveTransaction(tx) {
    const data = await this.read();
    data.transactions.push(tx);
    await this.write(data);
    return tx;
  }

  async updateTransaction(id, updatedTx) {
    const data = await this.read();
    const index = data.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      data.transactions[index] = { ...data.transactions[index], ...updatedTx };
      await this.write(data);
      return data.transactions[index];
    }
    throw new Error("Transaction not found");
  }

  async deleteTransaction(id) {
    const data = await this.read();
    data.transactions = data.transactions.filter(t => t.id !== id);
    await this.write(data);
    return true;
  }

  async getBudgets() {
    const data = await this.read();
    return data.budgets || [];
  }

  async saveBudget(budget) {
    const data = await this.read();
    const index = data.budgets.findIndex(
      b => b.yearMonth === budget.yearMonth && b.expenseType === budget.expenseType
    );
    if (index !== -1) {
      data.budgets[index].budgetAmount = budget.budgetAmount;
    } else {
      data.budgets.push(budget);
    }
    await this.write(data);
    return budget;
  }

  async getSettlements() {
    const data = await this.read();
    return data.settlements || [];
  }

  async saveSettlement(settlement) {
    const data = await this.read();
    data.settlements.push(settlement);
    await this.write(data);
    return settlement;
  }

  async settleMonth(yearMonth, fromUser, toUser, amount, date) {
    const data = await this.read();
    let count = 0;
    data.transactions.forEach(t => {
      if (t.date.substring(0, 7) === yearMonth && t.status === 'Outstanding') {
        t.status = 'Settled';
        count++;
      }
    });

    const newSettlement = {
      settlementId: "settle_" + Math.random().toString(36).substr(2, 9),
      yearMonth,
      fromUser,
      toUser,
      amount,
      settledDate: date
    };
    
    data.settlements.push(newSettlement);
    await this.write(data);
    return { count, settlement: newSettlement };
  }

  async getConfig() {
    const data = await this.read();
    if (!data.config) {
      data.config = {
        user1Name: process.env.USER1_NAME || "Alex",
        user2Name: process.env.USER2_NAME || "Sam"
      };
      await this.write(data);
    }
    return data.config;
  }

  async saveConfig(config) {
    const data = await this.read();
    data.config = {
      user1Name: config.user1Name || "Alex",
      user2Name: config.user2Name || "Sam"
    };
    await this.write(data);
    return data.config;
  }
}

// ----------------------------------------------------
// Google Sheets Database Adapter
// ----------------------------------------------------
class GoogleSheetsDatabaseAdapter {
  constructor(email, privateKey, spreadsheetId) {
    this.spreadsheetId = spreadsheetId;
    
    // Setup Auth
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    this.auth = new google.auth.JWT(
      email,
      null,
      formattedPrivateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.initialized = false;
  }

  // Ensure necessary worksheets and headers exist
  async ensureSheetsExist() {
    if (this.initialized) return;

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      const sheetsList = response.data.sheets.map(s => s.properties.title);
      const sheetIds = {};
      response.data.sheets.forEach(s => {
        sheetIds[s.properties.title] = s.properties.sheetId;
      });

      const requiredSheets = ['Transactions', 'Budgets', 'ExpenseTypes', 'Settlements', 'Config'];
      const requests = [];

      requiredSheets.forEach(sheetName => {
        if (!sheetsList.includes(sheetName)) {
          requests.push({
            addSheet: {
              properties: { title: sheetName }
            }
          });
        }
      });

      if (requests.length > 0) {
        const batchResponse = await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { requests }
        });
        // Refresh sheet mappings
        const updatedResponse = await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId
        });
        updatedResponse.data.sheets.forEach(s => {
          sheetIds[s.properties.title] = s.properties.sheetId;
        });
      }

      this.sheetIds = sheetIds;

      // Now ensure headers exist for each sheet
      await this.ensureHeaders();
      this.initialized = true;
    } catch (error) {
      console.error("Google Sheets initialization failed:", error);
      throw error;
    }
  }

  async ensureHeaders() {
    const headersConfig = {
      Transactions: ['ID', 'Date', 'PaidBy', 'Amount', 'ExpenseType', 'SplitRatio', 'User1Amount', 'User2Amount', 'Description', 'Status'],
      Budgets: ['YearMonth', 'ExpenseType', 'BudgetAmount'],
      ExpenseTypes: ['TypeName'],
      Settlements: ['SettlementID', 'YearMonth', 'FromUser', 'ToUser', 'Amount', 'SettledDate'],
      Config: ['Key', 'Value']
    };

    for (const [sheetName, headers] of Object.entries(headersConfig)) {
      const checkRange = `${sheetName}!A1:Z1`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: checkRange
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Write headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        });

        // Initialize default Config rows if the Config sheet was just created
        if (sheetName === 'Config') {
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: 'Config!A2:B3',
            valueInputOption: 'RAW',
            requestBody: {
              values: [
                ['User1Name', process.env.USER1_NAME || 'Alex'],
                ['User2Name', process.env.USER2_NAME || 'Sam']
              ]
            }
          });
        }
      }
    }
  }

  async getExpenseTypes() {
    await this.ensureSheetsExist();
    const response = await this.sheets.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'ExpenseTypes!A2:A'
    });
    const rows = response.data.values || [];
    return rows.map(r => r[0]).filter(Boolean);
  }

  async saveExpenseType(name) {
    await this.ensureSheetsExist();
    const existing = await this.getExpenseTypes();
    if (!existing.includes(name)) {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'ExpenseTypes!A:A',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[name]]
        }
      });
    }
    return name;
  }

  async deleteExpenseType(name) {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'ExpenseTypes!A2:A'
    });
    const rows = response.data.values || [];
    const index = rows.findIndex(r => r[0] === name);
    if (index !== -1) {
      const sheetId = this.sheetIds['ExpenseTypes'];
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: index + 1, // index + 1 accounts for header offset in index matching
                endIndex: index + 2
              }
            }
          }]
        }
      });
      return true;
    }
    return false;
  }

  async getTransactions() {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Transactions!A2:J'
    });
    const rows = response.data.values || [];
    return rows.map(row => ({
      id: row[0] || '',
      date: row[1] || '',
      paidBy: row[2] || '',
      amount: parseFloat(row[3]) || 0,
      expenseType: row[4] || '',
      splitRatio: row[5] || '',
      user1Amount: parseFloat(row[6]) || 0,
      user2Amount: parseFloat(row[7]) || 0,
      description: row[8] || '',
      status: row[9] || 'Outstanding'
    }));
  }

  async saveTransaction(tx) {
    await this.ensureSheetsExist();
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Transactions!A:J',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          tx.id,
          tx.date,
          tx.paidBy,
          tx.amount,
          tx.expenseType,
          tx.splitRatio,
          tx.user1Amount,
          tx.user2Amount,
          tx.description,
          tx.status
        ]]
      }
    });
    return tx;
  }

  async updateTransaction(id, updatedTx) {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Transactions!A2:A'
    });
    const rows = response.data.values || [];
    const index = rows.findIndex(r => r[0] === id);
    if (index !== -1) {
      const rowNumber = index + 2; // header offset + 0-indexed to 1-indexed

      // Get current values to merge
      const fullRowResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `Transactions!A${rowNumber}:J${rowNumber}`
      });
      const existingRow = fullRowResponse.data.values ? fullRowResponse.data.values[0] : [];
      
      const merged = {
        id: existingRow[0] || id,
        date: updatedTx.date !== undefined ? updatedTx.date : existingRow[1],
        paidBy: updatedTx.paidBy !== undefined ? updatedTx.paidBy : existingRow[2],
        amount: updatedTx.amount !== undefined ? updatedTx.amount : parseFloat(existingRow[3]),
        expenseType: updatedTx.expenseType !== undefined ? updatedTx.expenseType : existingRow[4],
        splitRatio: updatedTx.splitRatio !== undefined ? updatedTx.splitRatio : existingRow[5],
        user1Amount: updatedTx.user1Amount !== undefined ? updatedTx.user1Amount : parseFloat(existingRow[6]),
        user2Amount: updatedTx.user2Amount !== undefined ? updatedTx.user2Amount : parseFloat(existingRow[7]),
        description: updatedTx.description !== undefined ? updatedTx.description : existingRow[8],
        status: updatedTx.status !== undefined ? updatedTx.status : existingRow[9]
      };

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Transactions!A${rowNumber}:J${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            merged.id,
            merged.date,
            merged.paidBy,
            merged.amount,
            merged.expenseType,
            merged.splitRatio,
            merged.user1Amount,
            merged.user2Amount,
            merged.description,
            merged.status
          ]]
        }
      });
      return merged;
    }
    throw new Error("Transaction not found");
  }

  async deleteTransaction(id) {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Transactions!A2:A'
    });
    const rows = response.data.values || [];
    const index = rows.findIndex(r => r[0] === id);
    if (index !== -1) {
      const sheetId = this.sheetIds['Transactions'];
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: index + 1, // index + 1 to account for 0-index row list
                endIndex: index + 2
              }
            }
          }]
        }
      });
      return true;
    }
    return false;
  }

  async getBudgets() {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Budgets!A2:C'
    });
    const rows = response.data.values || [];
    return rows.map(row => ({
      yearMonth: row[0] || '',
      expenseType: row[1] || '',
      budgetAmount: parseFloat(row[2]) || 0
    }));
  }

  async saveBudget(budget) {
    await this.ensureSheetsExist();
    // Check if budget already exists
    const budgets = await this.getBudgets();
    const index = budgets.findIndex(
      b => b.yearMonth === budget.yearMonth && b.expenseType === budget.expenseType
    );

    if (index !== -1) {
      const rowNumber = index + 2;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Budgets!A${rowNumber}:C${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[budget.yearMonth, budget.expenseType, budget.budgetAmount]]
        }
      });
    } else {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Budgets!A:C',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[budget.yearMonth, budget.expenseType, budget.budgetAmount]]
        }
      });
    }
    return budget;
  }

  async getSettlements() {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Settlements!A2:F'
    });
    const rows = response.data.values || [];
    return rows.map(row => ({
      settlementId: row[0] || '',
      yearMonth: row[1] || '',
      fromUser: row[2] || '',
      toUser: row[3] || '',
      amount: parseFloat(row[4]) || 0,
      settledDate: row[5] || ''
    }));
  }

  async saveSettlement(settlement) {
    await this.ensureSheetsExist();
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Settlements!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          settlement.settlementId,
          settlement.yearMonth,
          settlement.fromUser,
          settlement.toUser,
          settlement.amount,
          settlement.settledDate
        ]]
      }
    });
    return settlement;
  }

  async settleMonth(yearMonth, fromUser, toUser, amount, date) {
    await this.ensureSheetsExist();
    
    // 1. Get all transactions to modify
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Transactions!A2:J'
    });
    
    const rows = response.data.values || [];
    let count = 0;
    
    // Map existing rows to object states and apply updates
    const updatedRows = rows.map((row) => {
      const txId = row[0];
      const txDate = row[1];
      const txStatus = row[9];
      
      if (txDate && txDate.substring(0, 7) === yearMonth && txStatus === 'Outstanding') {
        row[9] = 'Settled'; // Update status column index
        count++;
      }
      return row;
    });

    // 2. Batch update back to sheets
    if (count > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Transactions!A2:J${updatedRows.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updatedRows
        }
      });
    }

    // 3. Create a settlement event log
    const settlement = {
      settlementId: "settle_" + Math.random().toString(36).substr(2, 9),
      yearMonth,
      fromUser,
      toUser,
      amount,
      settledDate: date
    };

    await this.saveSettlement(settlement);

    return { count, settlement };
  }

  async getConfig() {
    await this.ensureSheetsExist();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Config!A2:B3'
    });
    const rows = response.data.values || [];
    const config = {
      user1Name: process.env.USER1_NAME || 'Alex',
      user2Name: process.env.USER2_NAME || 'Sam'
    };
    rows.forEach(r => {
      if (r[0] === 'User1Name' && r[1]) config.user1Name = r[1];
      if (r[0] === 'User2Name' && r[1]) config.user2Name = r[1];
    });
    return config;
  }

  async saveConfig(config) {
    await this.ensureSheetsExist();
    const u1 = config.user1Name || 'Alex';
    const u2 = config.user2Name || 'Sam';
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Config!A2:B3',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['User1Name', u1],
          ['User2Name', u2]
        ]
      }
    });
    return { user1Name: u1, user2Name: u2 };
  }
}

// ----------------------------------------------------
// Resilient Database Wrapper (Graceful Sheets Fallback)
// ----------------------------------------------------
class ResilientDatabase {
  constructor() {
    this.email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY;
    this.spreadsheetId = process.env.SPREADSHEET_ID;
    
    this.isGoogleSheets = !!(this.email && this.privateKey && this.spreadsheetId);
    this.fallbackMode = false;

    if (this.isGoogleSheets) {
      console.log("Database Mode: Attempting Google Sheets Connection...");
      this.adapter = new GoogleSheetsDatabaseAdapter(this.email, this.privateKey, this.spreadsheetId);
    } else {
      console.log("Database Mode: LOCAL MOCK JSON FILE ACTIVE (No Credentials Provided)");
      this.adapter = new MockDatabaseAdapter();
    }
  }

  async executeWithFallback(operation) {
    if (this.isGoogleSheets && !this.fallbackMode) {
      try {
        return await operation(this.adapter);
      } catch (error) {
        console.error("⚠️ GOOGLE SHEETS CONNECTION FAILED. GRACEFULLY FALLING BACK TO LOCAL MOCK DB!");
        console.error("Error Detail:", error.message);
        this.fallbackMode = true;
        this.adapter = new MockDatabaseAdapter();
        return await operation(this.adapter);
      }
    } else {
      return await operation(this.adapter);
    }
  }

  getMode() {
    if (this.isGoogleSheets && !this.fallbackMode) {
      return "Google Sheets";
    }
    if (this.isGoogleSheets && this.fallbackMode) {
      return "Local Mock Database (Sheets Connection Failed)";
    }
    return "Local Mock Database";
  }

  async getExpenseTypes() {
    return this.executeWithFallback(db => db.getExpenseTypes());
  }

  async saveExpenseType(name) {
    return this.executeWithFallback(db => db.saveExpenseType(name));
  }

  async deleteExpenseType(name) {
    return this.executeWithFallback(db => db.deleteExpenseType(name));
  }

  async getTransactions() {
    return this.executeWithFallback(db => db.getTransactions());
  }

  async saveTransaction(tx) {
    return this.executeWithFallback(db => db.saveTransaction(tx));
  }

  async updateTransaction(id, tx) {
    return this.executeWithFallback(db => db.updateTransaction(id, tx));
  }

  async deleteTransaction(id) {
    return this.executeWithFallback(db => db.deleteTransaction(id));
  }

  async getBudgets() {
    return this.executeWithFallback(db => db.getBudgets());
  }

  async saveBudget(budget) {
    return this.executeWithFallback(db => db.saveBudget(budget));
  }

  async getSettlements() {
    return this.executeWithFallback(db => db.getSettlements());
  }

  async saveSettlement(settlement) {
    return this.executeWithFallback(db => db.saveSettlement(settlement));
  }

  async settleMonth(yearMonth, fromUser, toUser, amount, date) {
    return this.executeWithFallback(db => db.settleMonth(yearMonth, fromUser, toUser, amount, date));
  }

  async getConfig() {
    return this.executeWithFallback(db => db.getConfig());
  }

  async saveConfig(config) {
    return this.executeWithFallback(db => db.saveConfig(config));
  }
}

// ----------------------------------------------------
// Database Factory
// ----------------------------------------------------
let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    dbInstance = new ResilientDatabase();
  }
  return dbInstance;
}

module.exports = { getDB };
