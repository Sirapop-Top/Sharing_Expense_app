# FairShare - 2-Person Expense Sharing Web Application

FairShare is a modern, mobile-responsive, full-stack web application designed for roommates, couples, or friends to track shared expenses, manage category-wise budgets, compute net balances, and perform bulk month-end settlements.

The application features a secure, real-time sync with a **Google Sheets Backend** and is built on a high-performance Express server + static HTML/CSS/JS client architecture.

---

## Key Features

1. **Dashboard Analytics**: Grouped visualizations of monthly spending, paid-by ratio split charts, and dynamic filters.
2. **Net Settlement Engine**: Live balance calculations that figure out who paid what, who owes whom, and how much, displaying intuitive status updates.
3. **Category Budgets**: Allocates monthly limits per category with progress indicators that change from green, to orange (80% used), to pulsing red (exceeded).
4. **Interactive Form Splits**: Standard 50:50 splits or custom proportional amounts with real-time total-sum validation.
5. **Settings & Category Configuration**: Live adding or deleting of expense categories that sync instantly to the backend.
6. **Bulk Settlement ("Settle All")**: Batch-settles outstanding items for the selected month, logs the transaction, and sets the state to "Settled" in a single action.

---

## Architecture & Database Design

The application is built with a **Dual Database Adapter Mode**:
- **Local Mock DB (Default)**: Resolves to `data/db.json` when Google Sheets API credentials are not provided. The app functions completely out-of-the-box, pre-filled with clean sample data so you can test all features immediately.
- **Google Sheets Sync**: Activated automatically when valid GCP service account credentials are in the `.env` file. The backend reads and writes directly to the sheets.

### Spreadsheet Schema
The application matches the exact required schemas on the following tabs:
1. `Transactions`: `[ID, Date, PaidBy, Amount, ExpenseType, SplitRatio, User1Amount, User2Amount, Description, Status]`
2. `Budgets`: `[YearMonth, ExpenseType, BudgetAmount]`
3. `ExpenseTypes`: `[TypeName]`
4. `Settlements`: `[SettlementID, YearMonth, FromUser, ToUser, Amount, SettledDate]`

> [!TIP]
> **Auto-Initialization**: If you connect a blank spreadsheet, the backend will automatically create these tabs and inject the correct headers on server startup!

---

## 🛠️ Step-by-Step Google Sheets Setup Guide

Follow these simple steps to hook FairShare up to your Google Sheet:

### Step 1: Set Up your Google Sheet
1. Open your browser and go to your Google Sheet:
   [Spreadsheet Link](https://docs.google.com/spreadsheets/d/1XD7hd5ZTUeNejSs9tgA7NwElZjUovjAqtr_Y1OiFzn8/edit?gid=1904234354#gid=1904234354)
2. Extract the **Spreadsheet ID** from the URL (the text between `/d/` and `/edit`):
   `1XD7hd5ZTUeNejSs9tgA7NwElZjUovjAqtr_Y1OiFzn8`

### Step 2: Generate Google service account credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `FairShare Expense App`).
3. Search for the **Google Sheets API** and click **Enable**.
4. Navigate to **IAM & Admin** > **Service Accounts**.
5. Click **Create Service Account**, fill in a name, and click **Done**.
6. Select the newly created service account, go to the **Keys** tab, and click **Add Key** > **Create New Key** > Select **JSON**.
7. Save the downloaded JSON file locally.

### Step 3: Grant access to the Service Account
1. Open the downloaded JSON credentials file and copy the `"client_email"` value.
2. In your Google Sheet, click the **Share** button in the top-right corner.
3. Paste the service account email, assign the **Editor** role, untick "Notify people", and click **Share**.

### Step 4: Configure environment variables
In the root directory of this project, open `.env` and fill in the parameters:
```env
PORT=3000
SPREADSHEET_ID=1XD7hd5ZTUeNejSs9tgA7NwElZjUovjAqtr_Y1OiFzn8

# Custom display names for your app UI:
USER1_NAME=Alex
USER2_NAME=Sam

# Google Cloud Service Account Credentials:
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account-email@gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
```
*(Make sure to enclose the private key in double quotes and replace physical newlines with `\n` to prevent parsing issues).*

### ⚡ Alternative: Connect via Google Apps Script (Easiest Method)

If you prefer not to set up a Google Cloud Service Account, you can connect FairShare to your Google Sheet using a **Google Apps Script Web App**:

1. Open your Google Sheet: [Spreadsheet Link](https://docs.google.com/spreadsheets/d/1XD7hd5ZTUeNejSs9tgA7NwElZjUovjAqtr_Y1OiFzn8/edit?gid=1904234354#gid=1904234354).
2. From the top menu, go to **Extensions** > **Apps Script**.
3. Delete any code in the editor, and copy-paste the entire contents of the [apps_script.js](file:///C:/Users/sirap/Desktop/AI/Project/Sharing_Expense_app/apps_script.js) file.
4. Click the **Save** icon (floppy disk) at the top.
5. Click the **Deploy** button (top right) > Select **New deployment**.
6. Click the gear icon next to "Select type" and select **Web app**.
7. Set the configuration details:
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone`
8. Click **Deploy**. 
9. Authorize the permissions (Click *Authorize Access* > Select your Google Account > Click *Advanced* > Click *Go to Project (unsafe)* > Click *Allow*).
10. Copy the generated **Web App URL** (e.g., `https://script.google.com/macros/s/AKfycb.../exec`).
11. Paste this URL into your `.env` file:
    ```env
    APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycb.../exec"
    ```
    *(When `APPS_SCRIPT_URL` is set, the application will automatically bypass local mock DB and GCP Service Account credentials and route all reads and writes directly through this Web App URL).*

---

## 🚀 Running the Application Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Run verification tests
Run the integration test suite to verify the mock database adapters and API endpoints:
```bash
npm run test
```

### 3. Launch the server
```bash
npm start
```
The console will boot the server:
```
==================================================
2-Person Expense Sharing Server active!
Local Access: http://localhost:3000
==================================================
```
Open `http://localhost:3000` in your web browser.

---

## 🐙 Push to GitHub Repository

We have provided a native git helper script. Simply configure a new empty repository on GitHub and execute:
```bash
npm run push
```
The script will initialize git (if needed), stage and commit your files, prompt for a remote repository URL, and push directly to your `main` branch.
