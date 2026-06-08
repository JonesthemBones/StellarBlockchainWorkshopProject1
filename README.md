# SariSariSettle

A blockchain-powered POS terminal for Philippine sari-sari stores. Accept multiple payment methods, settle to USDC instantly, and reconcile on-chain with one click.

## Problem

In the Philippines, **sari-sari stores** (small neighborhood convenience stores) are the backbone of retail commerce. During peak hours, owners accept GCash, Maya, cash, and bank transfers simultaneously. But at day's end, reconciliation becomes a nightmare:
- Cash drawers (manual counting, easy to miscount)
- GCash transaction logs (scattered, easy to lose)
- Maya reference numbers (manually tracked across devices)
- Bank transfer records (delayed settlement)

**Result:** Reconciliation takes 2–3 hours, frequent discrepancies, and lost transaction records.

## How It Works

1. **Cashier rings up a sale** → Uses an interactive numeric POS keypad to enter the transaction amount in PHP and product description (e.g., "Instant Noodles x2")
2. **QR code displays on standee** → A stunning tabletop terminal generates a Stellar Payment URI (SEP-7) with auto-calculated USDC equivalent
3. **Customer scans & pays** → Customer opens Freighter wallet, scans QR, and chooses to pay in **direct USDC** or **XLM with auto-swap**
4. **Instant settlement** → Payment hits the blockchain in 3–5 seconds; terminal flashes green **"PAYMENT CONFIRMED! 🎉"** and auto-records the transaction
5. **End-of-day reconciliation** → One-click CSV export gives the owner an itemized, on-chain verified sales ledger ready for bookkeeping

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

1. **Connect Freighter** — Link your Test Net wallet (vendor account)
2. **Fund via Friendbot** — Receive 10,000 XLM for testing (first-time only)
3. **Add USDC Trustline** — Register the USDC asset on your address (one transaction, ~3 seconds)
4. **POS Entry** — Open the **Interactive Numeric Keypad**, type a PHP amount (e.g., `250` for a typical sari-sari sale), and add a product memo (e.g., `"Calamansi x12"`)
5. **Generate QR** — Click "Generate QR Code" → The **Tabletop Standee** locks in the invoice and displays a scannable Stellar Payment URI
6. **Customer Payment** — In the **Payment Simulator** panel, choose **Direct USDC** or **XLM (Auto-Swap)**; tap "Confirm & Sign"; approve in Freighter
7. **Instant Confirmation** — Within 3–5 seconds, the **Standee flashes green** and displays **"PAYMENT CONFIRMED! 🎉"**; the **Sales Ledger** auto-updates below
8. **Export CSV** — Click "Export Sales Ledger (.CSV)" → Download a clean, audited reconciliation report with timestamps, memos, amounts, and PHP valuations

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
