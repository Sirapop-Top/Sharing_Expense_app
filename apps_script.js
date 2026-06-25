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

function formatDateIso(val) {
  if (!val) return "";
  if (val instanceof Date) {
    try {
      return Utilities.formatDate(val, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd");
    } catch (e) {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
  }
  var str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  
  // Parse DD/MM/YYYY or D/M/YYYY formats (common in Thailand / Europe)
  var parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    var p0 = parseInt(parts[0], 10);
    var p1 = parseInt(parts[1], 10);
    var p2 = parseInt(parts[2], 10);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (parts[2].length === 4) {
        var year = p2;
        if (year > 2400) year -= 543; // Buddhist Era adjustment (e.g. 2569 -> 2026)
        
        var month = p1;
        var day = p0;
        if (p1 > 12 && p0 <= 12) { // Handle MM/DD/YYYY if month is in first position
          month = p0;
          day = p1;
        }
        var yyyy = String(year);
        var mm = month < 10 ? "0" + month : String(month);
        var dd = day < 10 ? "0" + day : String(day);
        return yyyy + "-" + mm + "-" + dd;
      }
    }
  }

  try {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      try {
        return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd");
      } catch (e) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
    }
  } catch (e) {}
  
  return str.substring(0, 10);
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
      
      // Set column number formats when creating new sheets
      if (name === 'Transactions') {
        sheet.getRange("D2:D").setNumberFormat("#,##0.00");
        sheet.getRange("G2:H").setNumberFormat("#,##0.00");
      } else if (name === 'Budgets') {
        sheet.getRange("C2:C").setNumberFormat("#,##0.00");
      } else if (name === 'Settlements') {
        sheet.getRange("E2:E").setNumberFormat("#,##0.00");
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
      date: formatDateIso(rows[i][1]),
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
      settledDate: formatDateIso(rows[i][5])
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

/**
 * Run this function in the Google Apps Script Editor to view the structure of old monthly sheets.
 * Select 'inspectOldSheets' from the dropdown and click 'Run'.
 */
function inspectOldSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var months = ['MAR26', 'APR26', 'MAY26', 'JUN26'];
  months.forEach(function(month) {
    var sheet = ss.getSheetByName(month);
    if (!sheet) {
      Logger.log("⚠️ Sheet " + month + " not found.");
      return;
    }
    var values = sheet.getRange(1, 1, 5, 12).getValues(); // Get first 5 rows and 12 columns
    Logger.log("=== Sheet: " + month + " ===");
    Logger.log("Headers (Row 1): " + JSON.stringify(values[0]));
    Logger.log("Row 2 Data: " + JSON.stringify(values[1]));
    Logger.log("Row 3 Data: " + JSON.stringify(values[2]));
  });
}

/**
 * Run this function in the Google Apps Script Editor to migrate all historical data
 * from sheets 'MAR26', 'APR26', 'MAY26', and 'JUN26' into the 'Transactions' database.
 */
function migrateHistoryData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var months = ['MAR26', 'APR26', 'MAY26', 'JUN26'];
  
  ensureSheetsExist(ss);
  var targetSheet = ss.getSheetByName('Transactions');
  
  // Clear any existing transaction rows (except headers) to prevent double migration
  var lastRow = targetSheet.getLastRow();
  if (lastRow > 1) {
    targetSheet.getRange(2, 1, lastRow - 1, 10).clearContent();
  }
  
  var migratedCount = 0;
  
  months.forEach(function(month) {
    var sourceSheet = ss.getSheetByName(month);
    if (!sourceSheet) {
      Logger.log("⚠️ Month sheet " + month + " not found.");
      return;
    }
    
    var rows = sourceSheet.getDataRange().getValues();
    if (rows.length <= 1) return; // Only headers
    
    // Determine column indices based on header names (case-insensitive)
    var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });
    var dateIdx = headers.indexOf("date");
    var expenseIdx = headers.indexOf("expense");
    var costIdx = headers.indexOf("total cost");
    var statusIdx = headers.indexOf("status");
    var cppIdx = headers.indexOf("cost per person");
    var paidByIdx = headers.indexOf("paid by");
    var notesIdx = headers.indexOf("notes");
    
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      
      // Basic validation: must have date, description, and cost
      var rawDate = dateIdx !== -1 ? row[dateIdx] : "";
      var expense = expenseIdx !== -1 ? row[expenseIdx] : "";
      var totalCost = costIdx !== -1 ? parseFloat(row[costIdx]) : 0;
      
      if (!rawDate || !expense || isNaN(totalCost) || totalCost <= 0) {
        continue;
      }
      
      // 1. Format Date to YYYY-MM-DD
      var dateStr = formatDateIso(rawDate);
      
      // 2. Map Paid By (supports User 1/User 2 or display names like Alex/Sam)
      var rawPaidBy = paidByIdx !== -1 ? String(row[paidByIdx]).trim().toLowerCase() : "";
      var paidBy = "User 1"; // Default fallback
      if (rawPaidBy.indexOf("user 2") !== -1 || rawPaidBy.indexOf("sam") !== -1 || rawPaidBy === "2") {
        paidBy = "User 2";
      } else if (rawPaidBy.indexOf("user 1") !== -1 || rawPaidBy.indexOf("alex") !== -1 || rawPaidBy === "1") {
        paidBy = "User 1";
      }
      
      // 3. Map Description and Notes
      var notes = notesIdx !== -1 ? String(row[notesIdx]).trim() : "";
      var description = String(expense).trim();
      if (notes) {
        description += " (" + notes + ")";
      }
      
      // 4. Map Status
      var rawStatus = statusIdx !== -1 ? String(row[statusIdx]).trim().toLowerCase() : "";
      var status = "Outstanding";
      if (rawStatus === "settled" || rawStatus === "paid" || rawStatus === "done") {
        status = "Settled";
      }
      
      // 5. Guess Category based on description keywords
      var lowerDesc = description.toLowerCase();
      var category = "Miscellaneous"; // Default
      if (lowerDesc.indexOf("food") !== -1 || lowerDesc.indexOf("grocery") !== -1 || lowerDesc.indexOf("meal") !== -1 || lowerDesc.indexOf("eat") !== -1 || lowerDesc.indexOf("dinner") !== -1 || lowerDesc.indexOf("lunch") !== -1 || lowerDesc.indexOf("supermarket") !== -1 || lowerDesc.indexOf("restaurant") !== -1) {
        category = "Food";
      } else if (lowerDesc.indexOf("rent") !== -1 || lowerDesc.indexOf("room") !== -1 || lowerDesc.indexOf("apartment") !== -1) {
        category = "Rent";
      } else if (lowerDesc.indexOf("electric") !== -1 || lowerDesc.indexOf("water") !== -1 || lowerDesc.indexOf("utility") !== -1 || lowerDesc.indexOf("internet") !== -1 || lowerDesc.indexOf("wifi") !== -1 || lowerDesc.indexOf("power") !== -1 || lowerDesc.indexOf("bill") !== -1) {
        category = "Utilities";
      } else if (lowerDesc.indexOf("movie") !== -1 || lowerDesc.indexOf("netflix") !== -1 || lowerDesc.indexOf("game") !== -1 || lowerDesc.indexOf("entertainment") !== -1 || lowerDesc.indexOf("fun") !== -1 || lowerDesc.indexOf("play") !== -1 || lowerDesc.indexOf("major") !== -1) {
        category = "Entertainment";
      } else if (lowerDesc.indexOf("taxi") !== -1 || lowerDesc.indexOf("transport") !== -1 || lowerDesc.indexOf("bus") !== -1 || lowerDesc.indexOf("subway") !== -1 || lowerDesc.indexOf("fuel") !== -1 || lowerDesc.indexOf("gas") !== -1 || lowerDesc.indexOf("bts") !== -1 || lowerDesc.indexOf("mrt") !== -1 || lowerDesc.indexOf("grab") !== -1) {
        category = "Transport";
      }
      
      // 6. Map Split Ratio & Share Amounts
      var costPerPerson = cppIdx !== -1 ? parseFloat(row[cppIdx]) : 0;
      var splitRatio = "50:50";
      var user1Amount = totalCost / 2;
      var user2Amount = totalCost / 2;
      
      if (!isNaN(costPerPerson) && costPerPerson > 0 && Math.abs(costPerPerson - (totalCost / 2)) > 0.01) {
        splitRatio = "Custom";
        if (paidBy === "User 1") {
          user1Amount = totalCost - costPerPerson;
          user2Amount = costPerPerson;
        } else {
          user1Amount = costPerPerson;
          user2Amount = totalCost - costPerPerson;
        }
      }
      
      var id = "tx_mig_" + month.toLowerCase() + "_" + i + "_" + Math.random().toString(36).substr(2, 5);
      
      // Append row to Transactions sheet
      targetSheet.appendRow([
        id,
        dateStr,
        paidBy,
        totalCost,
        category,
        splitRatio,
        user1Amount,
        user2Amount,
        description,
        status
      ]);
      
      migratedCount++;
    }
  });
  
  // Apply formatting to all columns after migration
  formatAllColumns();
  
  Logger.log("🎉 Successfully migrated " + migratedCount + " transactions into the 'Transactions' tab!");
}

/**
 * Utility function to format all money/amount columns across all sheets to format x,xxx,xxx.xx
 */
function formatAllColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Format Transactions sheet
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet) {
    txSheet.getRange("D2:D").setNumberFormat("#,##0.00");
    txSheet.getRange("G2:H").setNumberFormat("#,##0.00");
    Logger.log("Formatted 'Transactions' amount columns D (Amount), G (User 1 Share), and H (User 2 Share).");
  }
  
  // Format Budgets sheet
  var budgetSheet = ss.getSheetByName('Budgets');
  if (budgetSheet) {
    budgetSheet.getRange("C2:C").setNumberFormat("#,##0.00");
    Logger.log("Formatted 'Budgets' limit column C (BudgetAmount).");
  }
  
  // Format Settlements sheet
  var settleSheet = ss.getSheetByName('Settlements');
  if (settleSheet) {
    settleSheet.getRange("E2:E").setNumberFormat("#,##0.00");
    Logger.log("Formatted 'Settlements' amount column E (Amount).");
  }
  
  // Format historical sheets
  var months = ['MAR26', 'APR26', 'MAY26', 'JUN26'];
  months.forEach(function(month) {
    var sourceSheet = ss.getSheetByName(month);
    if (sourceSheet) {
      sourceSheet.getRange("C2:C").setNumberFormat("#,##0.00");
      sourceSheet.getRange("E2:E").setNumberFormat("#,##0.00");
      Logger.log("Formatted '" + month + "' amount columns C (Total cost) and E (Cost per person).");
    }
  });
  
  Logger.log("🎉 All amount columns formatted successfully!");
}


