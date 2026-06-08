## Project Name
**SariSariSettle**

## One-Line Description
A blockchain-powered POS terminal for Philippine sari-sari stores that consolidates digital payments into a single, audited on-chain USDC balance via Stellar Path Payments.

## Track
**Track 2: Financial Inclusion & Everyday Payments**

## Problem It Solves
Sari-sari store owners across the Philippines accept multiple payment methods simultaneously—GCash, Maya, cash, and bank transfers. At day's end, reconciliation is a 2–3 hour nightmare: they manually cross-reference cash drawers, transaction logs across apps, and bank statements. Human error, missing receipts, and lost records lead to daily financial losses and zero audit trail. 

**SariSariSettle** solves this by unifying all customer payments into a single, immutable Stellar blockchain address, providing instant confirmation and one-click export to a fully reconciled CSV ledger.

## How It Uses Stellar

- **Path Payments** (`pathPaymentStrictReceive`) — Customers hold XLM but pay exact USDC; Stellar's DEX atomically swaps and delivers instantly, no manual currency conversion needed.
- **Classic Assets & Trustlines** (`Operation.changeTrust`) — Secure USDC registration on the merchant's wallet (Circle USDC on Soroban, SEP-41).
- **Transaction Memos** (`MEMO_TEXT`, 28 bytes) — Product descriptions (e.g., "Instant Noodles x2") permanently bound to the on-chain transaction, creating an immutable receipt.
- **Horizon API** — Real-time polling for payment detection (every 3 seconds) and querying the full reconciliation ledger for export.
- **Freighter Wallet** — Secure key management; no private keys stored in the app.
- **Stellar Testnet** — Full demo environment with Friendbot funding for workshop testing.
- **Bonus: Soroban Contracts** — Integrated Savings Goal tracker for complete track coverage.

Why Stellar? **Sub-penny fees** (1/100th of GCash), **instant settlement** (3–5 seconds vs. 1–2 day bank delays), **native DEX routing** (no intermediary exchanges), and **immutable audit trail** (all memos and amounts on-chain forever).

## GitHub Repository
[https://github.com/JonesthemBones/StellarBlockchainWorkshopProject1](https://github.com/JonesthemBones/StellarBlockchainWorkshopProject1)

## Network & Deployment
- **Network:** Stellar Testnet
- **Live app URL:** Runs locally — see README for setup instructions (`npm run dev -- --webpack`)
- **USDC Issuer (Testnet):** `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (Circle)
- **Contract IDs:** Savings Goal tracker deployed on Stellar Testnet (contract ID in deployment scripts)

## Team
- **Johnmel Villarosa Rojas** — @JonesthemBones

## Key Features

### Frontend (Next.js 16 + React 19)
- **Interactive POS Keypad** — 3×4 numeric entry for PHP amounts + product memos
- **Tabletop Standee Display** — Acrylic-style UI card with live Stellar Payment URI (SEP-7) QR code
- **Real-Time Payment Watcher** — Horizon polling with instant visual confirmation ("PAYMENT CONFIRMED! 🎉")
- **Payment Simulator** — Choose Direct USDC or XLM Path Payment; test end-to-end flow
- **Dynamic Sales Ledger** — Live transaction table with memos, amounts, timestamps, PHP valuations
- **One-Click Reconciliation Export** — CSV download for bookkeeping, tax records, bank reconciliation

### SDK & Integration
- `@stellar/stellar-sdk` v15 — Payment XDR builders (`buildPaymentXDR`, `buildPathPaymentXDR`)
- `@stellar/freighter-api` v6 — Wallet connection & signing with timeout protection
- Horizon REST API — Balance queries, payment polling, ledger reconciliation
- Soroban RPC — Contract invocation (bonus Savings Goal tracker)

## Tech Stack
- **Framework:** Next.js 16, React 19, TypeScript 5
- **Styling:** Tailwind CSS v4
- **Blockchain:** Stellar SDK v15, Freighter Wallet v6
- **Smart Contracts:** Soroban (Rust SDK v22)
- **Build:** Webpack (no Turbopack on Windows)
- **Node.js:** 20+

## Demo Flow
1. Connect Freighter wallet (Test Net)
2. Fund via Friendbot (10,000 XLM)
3. Add USDC Trustline
4. Enter a sale in the POS keypad (e.g., 250 PHP + "Calamansi x12")
5. Generate QR on the tabletop standee
6. Customer scans and pays (XLM or USDC)
7. Terminal confirms within 3–5 seconds
8. Export CSV for end-of-day bookkeeping

## Novelty Note

**SariSariSettle** is purpose-built for Philippine micro-retail—the largest retail demographic in Southeast Asia. Unlike generic payment apps, it combines:

1. **Real-world context** — Designed specifically for sari-sari store workflows (multiple payment methods, low margins, no access to traditional merchant services)
2. **On-chain memos for receipts** — Using Stellar's transaction memos as an immutable, itemized receipt ledger (novel for retail)
3. **Path Payments for currency flexibility** — Customers can pay in XLM; store settles in stable USDC without fee overhead
4. **One-click reconciliation** — CSV export of blockchain data for immediate bookkeeping (solving a critical pain point)

## Limitations & Future Work

- **Testnet-only** — Requires mainnet deployment & wallet security review for production
- **Manual QR scanning** — Future: NFC or direct API integration for automatic payment routing
- **Single-address consolidation** — Future: multi-account management for franchise chains
- **Offline support** — Future: cached transaction queue for stores with intermittent connectivity
- **SMS fallback** — Future: GCash/Maya webhook integration for non-blockchain customers

## Mentorship Shout-Out
Thanks to the **Stellar Development Foundation** for the SDK documentation, **Circle** for USDC on Stellar, and the **PUP QC & ALGOREX** teams for organizing the StellarX PH Workshop @ PUP QC (May 2026).

---

## Setup Instructions
```bash
git clone https://github.com/JonesthemBones/StellarBlockchainWorkshopProject1.git
cd StellarBlockchainWorkshopProject1/web
npm install
npm run dev -- --webpack
# Open http://localhost:3000
```

See **README.md** for full documentation, troubleshooting, and Stellar references.
