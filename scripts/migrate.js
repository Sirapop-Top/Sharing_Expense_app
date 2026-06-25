require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');

const MOCK_DB_FILE = path.join(__dirname, '../data/db.json');

async function migrate() {
  console.log("==================================================");
  console.log("🚀 FairShare Google Sheets Migration Tool");
  console.log("==================================================");

  // 1. Read local history database
  if (!fs.existsSync(MOCK_DB_FILE)) {
    console.error("❌ Error: Local database file (data/db.json) not found.");
    process.exit(1);
  }

  let localData;
  try {
    const raw = fs.readFileSync(MOCK_DB_FILE, 'utf8');
    localData = JSON.parse(raw);
  } catch (err) {
    console.error("❌ Error: Failed to parse data/db.json. Ensure it contains valid JSON.", err.message);
    process.exit(1);
  }

  // 2. Instantiate remote database connection
  const db = getDB();
  const activeMode = db.getMode();

  console.log(`- Local history file read successfully.`);
  console.log(`- Target cloud adapter: ${activeMode}`);

  if (activeMode === "Local Mock Database") {
    console.error("\n❌ ERROR: Cannot migrate. The app is currently configured to run in Local Mock Database mode.");
    console.error("Please configure APPS_SCRIPT_URL or GOOGLE_SERVICE_ACCOUNT credentials in your .env file first.");
    process.exit(1);
  }

  console.log("\nStarting data migration to Google Sheets...");

  // 3. Migrate Config
  if (localData.config) {
    console.log("\n⚙️ Migrating Config parameters...");
    try {
      await db.saveConfig(localData.config);
      console.log(`✓ Saved configuration: User1 = ${localData.config.user1Name}, User2 = ${localData.config.user2Name}`);
    } catch (e) {
      console.error(`⚠️ Failed to migrate config:`, e.message);
    }
  }

  // 4. Migrate Categories (Expense Types)
  if (localData.expenseTypes && Array.isArray(localData.expenseTypes)) {
    console.log("\n📂 Migrating Expense Categories...");
    for (const category of localData.expenseTypes) {
      try {
        await db.saveExpenseType(category);
        console.log(`✓ Created category: "${category}"`);
      } catch (e) {
        console.error(`⚠️ Failed to save category "${category}":`, e.message);
      }
    }
  }

  // 5. Migrate Budgets
  if (localData.budgets && Array.isArray(localData.budgets)) {
    console.log("\n💰 Migrating Budgets...");
    for (const budget of localData.budgets) {
      try {
        await db.saveBudget(budget);
        console.log(`✓ Set limit for "${budget.expenseType}" (${budget.yearMonth}): ฿${budget.budgetAmount}`);
      } catch (e) {
        console.error(`⚠️ Failed to save budget for "${budget.expenseType}":`, e.message);
      }
    }
  }

  // 6. Migrate Transactions
  if (localData.transactions && Array.isArray(localData.transactions)) {
    console.log("\n📝 Migrating Expense Transactions...");
    // Retrieve existing transactions to avoid duplicate keys if any
    let existingTxs = [];
    try {
      existingTxs = await db.getTransactions();
    } catch (e) {
      console.warn("Could not check for existing transactions, writing all items.");
    }
    const existingIds = new Set(existingTxs.map(t => t.id).filter(Boolean));

    for (const tx of localData.transactions) {
      if (existingIds.has(tx.id)) {
        console.log(`- Transaction "${tx.description || tx.id}" already exists on Google Sheets. Skipping.`);
        continue;
      }
      try {
        await db.saveTransaction(tx);
        console.log(`✓ Migrated transaction: "${tx.description}" (฿${tx.amount})`);
      } catch (e) {
        console.error(`⚠️ Failed to save transaction "${tx.id}":`, e.message);
      }
    }
  }

  // 7. Migrate Settlements
  if (localData.settlements && Array.isArray(localData.settlements)) {
    console.log("\n🤝 Migrating Settlement logs...");
    let existingSets = [];
    try {
      existingSets = await db.getSettlements();
    } catch (e) {
      console.warn("Could not check for existing settlements.");
    }
    const existingSetIds = new Set(existingSets.map(s => s.settlementId).filter(Boolean));

    for (const s of localData.settlements) {
      if (existingSetIds.has(s.settlementId)) {
        console.log(`- Settlement "${s.settlementId}" already exists. Skipping.`);
        continue;
      }
      try {
        await db.saveSettlement(s);
        console.log(`✓ Migrated settlement: ฿${s.amount} from ${s.fromUser} to ${s.toUser} (${s.yearMonth})`);
      } catch (e) {
        console.error(`⚠️ Failed to save settlement "${s.settlementId}":`, e.message);
      }
    }
  }

  console.log("\n==================================================");
  console.log("🎉 DATA MIGRATION COMPLETED SUCCESSFULLY!");
  console.log("==================================================\n");
}

migrate().catch(err => {
  console.error("❌ Migration failed with critical error:", err);
});
