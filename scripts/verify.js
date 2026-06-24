const { getDB } = require('../db');
const http = require('http');

async function testDatabase() {
  console.log("=== Running DB Adapter Tests ===");
  const db = getDB();
  
  // Test expense types
  console.log("1. Testing Expense Types...");
  const initialTypes = await db.getExpenseTypes();
  console.log(`- Current Types: ${JSON.stringify(initialTypes)}`);
  
  await db.saveExpenseType("TestCategory");
  const updatedTypes = await db.getExpenseTypes();
  if (!updatedTypes.includes("TestCategory")) {
    throw new Error("Failed to add Expense Type");
  }
  console.log("- Save Expense Type: PASSED");

  await db.deleteExpenseType("TestCategory");
  const finalTypes = await db.getExpenseTypes();
  if (finalTypes.includes("TestCategory")) {
    throw new Error("Failed to delete Expense Type");
  }
  console.log("- Delete Expense Type: PASSED");

  // Test transactions
  console.log("2. Testing Transactions...");
  const tx = {
    id: "tx_test_123",
    date: "2026-06-24",
    paidBy: "User 1",
    amount: 100,
    expenseType: "Rent",
    splitRatio: "50:50",
    user1Amount: 50,
    user2Amount: 50,
    description: "Integration Test Expense",
    status: "Outstanding"
  };

  await db.saveTransaction(tx);
  const txList = await db.getTransactions();
  const savedTx = txList.find(t => t.id === tx.id);
  if (!savedTx || savedTx.amount !== 100) {
    throw new Error("Failed to save transaction correctly");
  }
  console.log("- Save Transaction: PASSED");

  await db.updateTransaction(tx.id, { amount: 150, user1Amount: 75, user2Amount: 75 });
  const updatedTxList = await db.getTransactions();
  const updatedTx = updatedTxList.find(t => t.id === tx.id);
  if (!updatedTx || updatedTx.amount !== 150) {
    throw new Error("Failed to update transaction");
  }
  console.log("- Update Transaction: PASSED");

  await db.deleteTransaction(tx.id);
  const deletedTxList = await db.getTransactions();
  if (deletedTxList.some(t => t.id === tx.id)) {
    throw new Error("Failed to delete transaction");
  }
  console.log("- Delete Transaction: PASSED");
  
  console.log("=== DB Adapter Tests: ALL PASSED ===\n");
}

function runServerAndTest() {
  return new Promise((resolve, reject) => {
    console.log("=== Running Express API Server Integration Tests ===");
    
    // Set test environment config
    process.env.PORT = "3099";
    process.env.USER1_NAME = "TestAlex";
    process.env.USER2_NAME = "TestSam";

    // Load server
    const server = require('../server.js');

    // Wait a brief moment for server boot
    setTimeout(() => {
      // 1. Get Config Endpoint
      http.get('http://localhost:3099/api/config', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const config = JSON.parse(data);
            console.log(`- Config response: ${data}`);
            if (config.user1Name !== "TestAlex" || config.user2Name !== "TestSam") {
              throw new Error("Custom display names not set correctly in API config response");
            }
            console.log("- GET /api/config: PASSED");
            
            // 2. Fetch Transactions
            http.get('http://localhost:3099/api/transactions', (resTx) => {
              let txData = '';
              resTx.on('data', chunk => txData += chunk);
              resTx.on('end', () => {
                try {
                  const txs = JSON.parse(txData);
                  console.log(`- Transactions count fetched: ${txs.length}`);
                  console.log("- GET /api/transactions: PASSED");
                  
                  console.log("=== Express API Integration Tests: ALL PASSED ===");
                  process.exit(0);
                } catch (e) {
                  reject(e);
                }
              });
            });
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    }, 1500);
  });
}

async function run() {
  try {
    await testDatabase();
    await runServerAndTest();
  } catch (error) {
    console.error("❌ Tests Failed:", error);
    process.exit(1);
  }
}

run();
