# Tabletop Vendor Payment Aggregator

A real-time cashier POS terminal that consolidates multiple digital payments into a single, audited on-chain USDC balance via SEP-7 payment URIs.

## Problem

In the Philippines, weekend bazaars and pop-up food markets are booming, but micro-vendors face a daily reconciliation nightmare. Merchants accept GCash, Maya, cash, and bank transfers simultaneously, then spend hours at day's end cross-referencing:
- Cash drawers (manual, error-prone)
- Bank statements (1–2 day settlement lag)
- GCash SMS logs (easy to lose, screenshots can be faked)
- Maya reference numbers (scattered across devices)

**Result:** Lost transactions, reconciliation errors, unexplained discrepancies, and direct financial losses.

## How It Works

1. **Cashier enters a sale** → Types PHP amount + product memo (e.g., "Caramel Macchiato") into a POS keypad
2. **QR code appears** → Standee display generates a Stellar Payment URI (SEP-7) with auto-calculated USDC amount
3. **Customer scans & pays** → Using Freighter wallet, customer chooses **Direct USDC** or **XLM Path Payment** (auto-swap)
4. **Real-time confirmation** → Terminal polls Horizon every 3 seconds; when transaction lands, flashes **"PAYMENT CONFIRMED! 🎉"**
5. **Auto-reconciliation** → All transactions recorded with on-chain memos; one-click CSV export for daily bookkeeping

## How It Uses Stellar

- **Path Payments** (`pathPaymentStrictReceive`) — Customers hold only XLM but pay exact USDC; Stellar's DEX atomically routes and delivers to merchant
- **Classic Assets & Trustlines** (`Operation.changeTrust`) — USDC trustline registration; Circle USDC (SEP-41) for settlement
- **Transaction Memos** (`MEMO_TEXT`, 28 bytes) — Product descriptions permanently bound to on-chain transactions
- **Horizon API** — Real-time polling for payment detection; queries for vendor reconciliation ledger
- **Freighter Wallet** — Secure signing; no private keys stored in the app
- **Stellar Testnet** — Full demo environment with Friendbot funding
- **Bonus: Soroban** — Integrated Savings Goal tracker contract for complete track coverage

Why Stellar? **Sub-penny fees, near-instant settlement, native DEX routing, and immutable on-chain audit trail** — exactly what micro-merchants need.

## Track

**Financial Inclusion / DeFi & RWA** (Primary)  
**Smart Contracts & Soroban** (Bonus coverage)

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript 5
- **Styling:** Tailwind CSS v4 + PostCSS
- **Stellar SDK:** `@stellar/stellar-sdk` v15
- **Wallet:** `@stellar/freighter-api` v6
- **Network:** Stellar Testnet
- **Smart Contracts:** Soroban (Rust SDK v22)
- **Build Tool:** Webpack (no Turbopack on Windows)

## Setup & Run

### Prerequisites
- **Node.js 20+** and **npm**
- **Freighter** browser extension (v6+), switched to **Test Net**

### Installation

```bash
git clone https://github.com/JonesthemBones/StellarBlockchainWorkshopProject1.git
cd StellarBlockchainWorkshopProject1/web
npm install
npm run dev -- --webpack
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

No custom env vars needed — all Testnet defaults are baked in:
- **Horizon:** `https://horizon-testnet.stellar.org`
- **Soroban RPC:** `https://soroban-testnet.stellar.org`
- **USDC Issuer:** `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (Circle, Testnet)

## Demo Flow

1. **Connect Freighter** — Link your Test Net wallet
2. **Fund via Friendbot** — Receive 10,000 XLM (first-time only)
3. **Add USDC Trustline** — Register the asset on your address
4. **POS Entry** — Type a PHP amount (e.g., `150`) + item memo (e.g., `"Flat White"`)
5. **Generate QR** — Standee locks in invoice and displays scannable URI
6. **Customer Payment** — Choose **Direct USDC** or **XLM (Swap)** in the simulator; sign in Freighter
7. **Instant Confirmation** — Within 3–5 seconds, terminal flashes green and records the transaction
8. **Export CSV** — Download itemized sales ledger with memo tags and PHP valuations

## Network Details

| Parameter | Value |
|-----------|-------|
| **Network** | Stellar Testnet |
| **Horizon URL** | https://horizon-testnet.stellar.org |
| **Soroban RPC** | https://soroban-testnet.stellar.org |
| **Network Passphrase** | `Test SDF Network ; September 2015` |
| **USDC Issuer** | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| **Friendbot** | https://friendbot.stellar.org |
| **Explorer** | https://stellar.expert/explorer/testnet |

## Key Files

| File | Purpose |
|------|---------|
| `web/src/app/page.tsx` | Main dashboard: POS, standee, ledger, simulator |
| `web/src/lib/payment.ts` | Payment & path payment XDR builders; submission & polling |
| `web/src/lib/balances.ts` | Horizon queries for vendor reconciliation |
| `web/src/lib/csv.ts` | CSV statement export |
| `web/src/lib/stellar.ts` | Testnet config & Friendbot |
| `contracts/savings-goal/src/lib.rs` | Soroban savings tracker (bonus) |

## Team

- **Jones** — @JonesthemBones

## License

MIT
