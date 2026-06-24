/**
 * FairShare Google Apps Script Web App Database Router
 * Copy-paste this entire code inside Extensions > Apps Script in your Google Sheet.
 * Then deploy it as a Web App (Accessible to "Anyone").
 */

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);
  
  if (action === 'getConfig') {
    return jsonResponse(getConfigData(ss));
  } else if (action === 'getExpenseTypes') {
    return jsonResponse(getExpenseTypesData(ss));
  } else if (action === 'getTransactions') {
    return jsonResponse(getTransactionsData(ss));
  } else if (action === 'getBudgets') {
    return jsonResponse(getBudgetsData(ss));
  } else if (action === 'getSettlements') {
    return jsonResponse(getSettlementsData(ss));
  } else {
    // Return all merged structures
    var allData = {
      config: getConfigData(ss),
      expenseTypes: getExpenseTypesData(ss),
      transactions: getTransactionsData(ss),
      budgets: getBudgetsData(ss),
      settlements: getSettlementsData(ss)
    };
    return jsonResponse(allData);
  }
}

function doPost(e) {
  var postData = JSON.parse(e.postData.contents);
  var action = postData.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);
  
  var result = { success: false };
  
  if (action === 'saveTransaction') {
    result = saveTransaction(ss, postData.tx);
  } else if (action === 'updateTransaction') {
    result = updateTransaction(ss, postData.id, postData.tx);
  } else if (action === 'deleteTransaction') {
    result = deleteTransaction(ss, postData.id);
  } else if (action === 'saveBudget') {
    result = saveBudget(ss, postData.budget);
  } else if (action === 'saveExpenseType') {
    result = saveExpenseType(ss, postData.name);
  } else if (action === 'deleteExpenseType') {
    result = deleteExpenseType(ss, postData.name);
  } else if (action === 'settleMonth') {
    result = settleMonth(ss, postData.yearMonth, postData.fromUser, postData.toUser, postData.amount, postData.date);
  } else if (action === 'saveConfig') {
    result = saveConfig(ss, postData.config);
  }
  
  return jsonResponse(result);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================
// DATABASE LOGIC & SCHEMA MANAGEMENT
// ==========================================================

function ensureSheetsExist(ss) {
  var required = {
    Transactions: ['ID', 'Date', 'PaidBy', 'Amount', 'ExpenseType', 'SplitRatio', 'User1Amount', 'User2Amount', 'Description', 'Status'],
    Budgets: ['YearMonth', 'ExpenseType', 'BudgetAmount'],
    ExpenseTypes: ['TypeName'],
    Settlements: ['SettlementID', 'YearMonth', 'FromUser', 'ToUser', 'Amount', 'SettledDate'],
    Config: ['Key', 'Value']
  };
  
  for (var name in required) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(required[name]);
      
      // Inject default config keys if config sheet is new
      if (name === 'Config') {
        sheet.appendRow(['User1Name', 'Alex']);
        sheet.appendRow(['User2Name', 'Sam']);
      }
      
      // Inject default categories if ExpenseTypes is new
      if (name === 'ExpenseTypes') {
        var defaults = ['Food', 'Utilities', 'Rent', 'Entertainment', 'Transport', 'Miscellaneous'];
        defaults.forEach(function(d) {
          sheet.appendRow([d]);
        });
      }
    }
  }
}

// Config Sheet API
function getConfigData(ss) {
  var rows = ss.getSheetByName('Config').getDataRange().getValues();
  var config = { user1Name: 'Alex', user2Name: 'Sam' };
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'User1Name' && rows[i][1]) config.user1Name = rows[i][1];
    if (rows[i][0] === 'User2Name' && rows[i][1]) config.user2Name = rows[i][1];
  }
  return config;
}

function saveConfig(ss, config) {
  var sheet = ss.getSheetByName('Config');
  sheet.clearContents();
  sheet.appendRow(['Key', 'Value']);
  sheet.appendRow(['User1Name', config.user1Name || 'Alex']);
  sheet.appendRow(['User2Name', config.user2Name || 'Sam']);
  return { success: true };
}

// Categories API
function getExpenseTypesData(ss) {
  var rows = ss.getSheetByName('ExpenseTypes').getDataRange().getValues();
  var types = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) types.push(rows[i][0]);
  }
  return types;
}

function saveExpenseType(ss, name) {
  var sheet = ss.getSheetByName('ExpenseTypes');
  var existing = getExpenseTypesData(ss);
  if (existing.indexOf(name) === -1) {
    sheet.appendRow([name]);
  }
  return { success: true };
}

function deleteExpenseType(ss, name) {
  var sheet = ss.getSheetByName('ExpenseTypes');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}

// Transactions API
function getTransactionsData(ss) {
  var rows = ss.getSheetByName('Transactions').getDataRange().getValues();
  var txs = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    txs.push({
      id: rows[i][0],
      date: String(rows[i][1]).substring(0, 10) || rows[i][1], // Parse formats
      paidBy: rows[i][2],
      amount: parseFloat(rows[i][3]) || 0,
      expenseType: rows[i][4],
      splitRatio: rows[i][5],
      user1Amount: parseFloat(rows[i][6]) || 0,
      user2Amount: parseFloat(rows[i][7]) || 0,
      description: rows[i][8] || '',
      status: rows[i][9] || 'Outstanding'
    });
  }
  return txs;
}

function saveTransaction(ss, tx) {
  var sheet = ss.getSheetByName('Transactions');
  sheet.appendRow([
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
  ]);
  return { success: true };
}

function updateTransaction(ss, id, tx) {
  var sheet = ss.getSheetByName('Transactions');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      var rowNum = i + 1;
      sheet.getRange(rowNum, 1, 1, 10).setValues([[
        id,
        tx.date || rows[i][1],
        tx.paidBy || rows[i][2],
        tx.amount !== undefined ? tx.amount : rows[i][3],
        tx.expenseType || rows[i][4],
        tx.splitRatio || rows[i][5],
        tx.user1Amount !== undefined ? tx.user1Amount : rows[i][6],
        tx.user2Amount !== undefined ? tx.user2Amount : rows[i][7],
        tx.description !== undefined ? tx.description : rows[i][8],
        tx.status || rows[i][9]
      ]]);
      return { success: true };
    }
  }
  return { success: false };
}

function deleteTransaction(ss, id) {
  var sheet = ss.getSheetByName('Transactions');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}

// Budgets API
function getBudgetsData(ss) {
  var rows = ss.getSheetByName('Budgets').getDataRange().getValues();
  var budgets = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    budgets.push({
      yearMonth: rows[i][0],
      expenseType: rows[i][1],
      budgetAmount: parseFloat(rows[i][2]) || 0
    });
  }
  return budgets;
}

function saveBudget(ss, budget) {
  var sheet = ss.getSheetByName('Budgets');
  var rows = sheet.getDataRange().getValues();
  var found = false;
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === budget.yearMonth && rows[i][1] === budget.expenseType) {
      sheet.getRange(i + 1, 3).setValue(budget.budgetAmount);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([budget.yearMonth, budget.expenseType, budget.budgetAmount]);
  }
  return { success: true };
}

// Settlements API
function getSettlementsData(ss) {
  var rows = ss.getSheetByName('Settlements').getDataRange().getValues();
  var sets = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    sets.push({
      settlementId: rows[i][0],
      yearMonth: rows[i][1],
      fromUser: rows[i][2],
      toUser: rows[i][3],
      amount: parseFloat(rows[i][4]) || 0,
      settledDate: String(rows[i][5]).substring(0, 10) || rows[i][5]
    });
  }
  return sets;
}

function saveSettlement(ss, s) {
  var sheet = ss.getSheetByName('Settlements');
  sheet.appendRow([
    s.settlementId,
    s.yearMonth,
    s.fromUser,
    s.toUser,
    s.amount,
    s.settledDate
  ]);
  return { success: true };
}

// Settle All API
function settleMonth(ss, yearMonth, fromUser, toUser, amount, date) {
  var sheet = ss.getSheetByName('Transactions');
  var rows = sheet.getDataRange().getValues();
  var count = 0;
  
  for (var i = 1; i < rows.length; i++) {
    var txDate = String(rows[i][1]);
    var status = rows[i][9];
    if (txDate.substring(0, 7) === yearMonth && status === 'Outstanding') {
      sheet.getRange(i + 1, 10).setValue('Settled');
      count++;
    }
  }
  
  var settlement = {
    settlementId: "settle_" + Math.random().toString(36).substr(2, 9),
    yearMonth: yearMonth,
    fromUser: fromUser,
    toUser: toUser,
    amount: amount,
    settledDate: date
  };
  
  saveSettlement(ss, settlement);
  return { success: true, count: count, settlement: settlement };
}
