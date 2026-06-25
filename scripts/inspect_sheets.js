require('dotenv').config();
const { google } = require('googleapis');

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;

if (!email || !privateKey || !spreadsheetId) {
  console.error("❌ Error: Missing Google Sheets credentials in .env");
  process.exit(1);
}

// Clean private key formatting
let cleanKey = privateKey.trim();
if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
  cleanKey = cleanKey.substring(1, cleanKey.length - 1);
}
if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
  cleanKey = cleanKey.substring(1, cleanKey.length - 1);
}
const formattedPrivateKey = cleanKey.replace(/\\n/g, '\n');

const auth = new google.auth.JWT(
  email,
  null,
  formattedPrivateKey,
  ['https://www.googleapis.com/auth/spreadsheets.readonly']
);

const sheets = google.sheets({ version: 'v4', auth });

async function inspect() {
  console.log("==================================================");
  console.log("🔍 Inspecting Google Spreadsheet Sheets...");
  console.log(`Spreadsheet ID: ${spreadsheetId}`);
  console.log("==================================================");

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = meta.data.sheets.map(s => s.properties.title);
    console.log(`Available sheets: ${JSON.stringify(sheetsList)}\n`);

    const months = ['MAR26', 'APR26', 'MAY26', 'JUN26'];
    for (const month of months) {
      if (!sheetsList.includes(month)) {
        console.log(`⚠️ Sheet "${month}" not found.`);
        continue;
      }

      console.log(`--- Inspecting Sheet: "${month}" ---`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${month}!A1:Z10` // Fetch first 10 rows to inspect headers and data
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log("No data found in this sheet.");
      } else {
        console.log(`Header Row (A1:Z1):`);
        console.log(JSON.stringify(rows[0]));
        console.log(`\nFirst 3 Data Rows:`);
        rows.slice(1, 4).forEach((row, i) => {
          console.log(`Row ${i + 2}: ${JSON.stringify(row)}`);
        });
      }
      console.log("------------------------------------------\n");
    }
  } catch (error) {
    console.error("❌ Inspection failed:", error.message);
  }
}

inspect();
