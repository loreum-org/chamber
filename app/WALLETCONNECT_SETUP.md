# WalletConnect Setup Guide

## What are those console errors?

The errors you're seeing are related to **WalletConnect** configuration. Here's what each one means:

### 1. **403 Errors from api.web3modal.org**
```
Failed to load resource: the server responded with a status of 403
```
**Cause**: Invalid or missing WalletConnect Project ID  
**Impact**: Wallet connection features won't work properly  
**Fix**: Get a free project ID (see below)

### 2. **400 Errors from pulse.walletconnect.org**
```
Failed to load resource: the server responded with a status of 400
```
**Cause**: Same as above - invalid project ID  
**Impact**: Analytics/telemetry won't work (not critical for development)

### 3. **Reown Config Failed to Fetch**
```
[Reown Config] Failed to fetch remote project configuration
```
**Cause**: Invalid project ID preventing WalletConnect from fetching configuration  
**Impact**: Wallet connection UI may not display all wallet options

### 4. **Lit Protocol Dev Mode Warning**
```
Lit is in dev mode. Not recommended for production!
```
**Cause**: Lit Protocol (used by WalletConnect) is running in development mode  
**Impact**: None - just a warning. This is normal for development.

### 5. **Message Channel Error**
```
Uncaught (in promise) Error: A listener indicated an asynchronous response...
```
**Cause**: Browser extension communication issue (often from wallet extensions)  
**Impact**: Usually harmless - can be ignored unless wallet connections aren't working

## How to Fix

### Step 1: Get a Free WalletConnect Project ID

1. Go to [https://cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Sign up or log in (it's free)
3. Click "Create New Project"
4. Give it a name (e.g., "Chamber Dev")
5. Copy the **Project ID** (it's a long string of characters)

### Step 2: Add to Your .env File

Open `app/.env` and add your project ID:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_actual_project_id_here
```

### Step 3: Restart Your Dev Server

After adding the project ID, restart your Vite dev server:

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## For Local Development Only

If you're **only testing locally** with MetaMask or other browser extension wallets, you can ignore these errors. The wallet connection will still work through browser extensions, but:

- ❌ WalletConnect QR code connections won't work
- ❌ Mobile wallet connections won't work  
- ✅ Browser extension wallets (MetaMask, etc.) will still work
- ✅ The app will function normally

The errors are just warnings and won't break your app - they're just API calls failing because of the invalid project ID.

## Verification

After adding your project ID, you should see:
- ✅ No 403/400 errors in the console
- ✅ Wallet connection modal shows more wallet options
- ✅ QR code scanning works for mobile wallets
