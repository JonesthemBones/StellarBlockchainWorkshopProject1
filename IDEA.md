# Tabletop Vendor Payment Aggregator

A complete, high-fidelity tabletop bazaar cashier terminal built on the Stellar Network for the StellarX PH Workshop. 

## Idea
- **Track:** Financial Inclusion / DeFi & RWA
- **Idea #:** 32 (Digital Cash Drawers for Micro-Merchants)
- **One-liner:** A tabletop cashier standee that consolidates multiple digital payments into a single, audited on-chain USDC balance via a single, auto-reconciling QR code.

## Problem
In the Philippines, weekend bazaars and pop-up food markets are booming. To avoid losing sales, micro-vendors accept GCash, Maya, cash, and bank transfers. However, at the end of the night, reconciliation is a nightmare. Merchants spend hours cross-referencing cash drawers, bank statements, GCash SMS logs, and Maya reference numbers. Human error, missing SMS alerts, and fake payment screenshots lead to direct financial losses.

## How it uses Stellar
Stellar is the perfect backbone for merchant payments because of its near-instant speed, sub-penny transaction costs, and native asset capabilities:
1. **Single-Address Consolidation**: Vendors receive all payments into a single on-chain Stellar address, creating an immutable, unified digital cash box.
2. **Circle USDC Stablecoin**: Settling in USDC ensures that merchant balances are stable, inflation-resistant, and represent real-world purchasing power.
3. **USDC Trustlines**: The terminal handles secure trustline registration (`Operation.changeTrust`) to enable the merchant address to receive USDC.
4. **Stellar Path Payments (`pathPaymentStrictReceive`)**: *The ultimate payment convenience.* Customers who only hold XLM can pay using XLM. Stellar's built-in decentralized exchange (DEX) atomically and instantly routes their XLM through the order books and deposits the exact requested USDC amount into the merchant's wallet.
5. **On-Chain Transaction Memos**: The cashier keys in specific products (e.g., `"2 Croissants"`) which are compiled as `MEMO_TEXT` directly into the on-chain transaction. This permanently binds the sale description to the payment on the blockchain.
6. **Real-time Horizon Polling**: The tabletop terminal polls Horizon every 3 seconds for new ledgers. The moment a transaction with the correct memo and USDC amount lands, the terminal instantly rings green.
7. **One-Click statement Export**: Vendors can instantly export their on-chain ledger history directly into a clean, itemized Excel-compatible CSV spreadsheet, solving daily business bookkeeping instantly.

## What works in the demo
- [x] **Freighter Wallet Connection**: Securely connects the vendor address on Stellar Testnet.
- [x] **Cashier POS Terminal**: Interactive 3x4 numeric keypad to type PHP amounts and product memos.
- [x] **Auto-USDC Conversion**: Real-time conversion of PHP to USDC based on currency rates ($1 = 56 PHP).
- [x] **Tabletop QR Standee Display**: A visually striking standee card that generates standard **Stellar payment URIs (SEP-7)**.
- [x] **Real-Time Payment Watcher**: Automated ledger polling that catches transactions instantly and sounds a visual confirmation.
- [x] **Customer Simulator**: A panel that lets you act as the customer, choosing between **Direct USDC Payment** or **XLM Path Payment (Auto-Swap)**, signing in Freighter, and executing the transaction.
- [x] **Sales Ledger & Reconciliation Journal**: A clean database showing all transactions, timestamps, customer public keys, settled amounts, PHP valuations, and item tags.
- [x] **Reconciliation Statement Export**: Instantly trigger a `.csv` download of the itemized sales journal.
- [x] **Soroban Smart Contract Extension (Bonus)**: A collapsible panel containing the workshop's deployed Soroban *Savings Goal tracker* for complete track coverage.

## Setup / run
To run the project locally on Stellar Testnet:

1. **Clone & Open:**
   Navigate to the `web` workspace directory:
   ```bash
   cd web
   npm install
   ```

2. **Environment Setup:**
   Ensure the testnet config is loaded. No custom keys are needed; the app is pre-configured for public Testnet:
   - Horizon Server: `https://horizon-testnet.stellar.org`
   - RPC Server: `https://soroban-testnet.stellar.org`
   - USDC Issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

3. **Launch the dApp:**
   ```bash
   npm run dev
   ```
   Open your browser to [http://localhost:3000](http://localhost:3000).

4. **Interactive Demo Steps:**
   - Click **Connect Vendor Wallet** to link Freighter (make sure Freighter is on **Test Net**).
   - If your wallet is new, click **Fund via Friendbot** in the yellow alert box to get 10,000 XLM.
   - Click **Add USDC Trustline** to register the USDC asset on your wallet address.
   - In the POS keypad, type a purchase amount (e.g., `150` PHP) and add an item memo (e.g., `"Caramel Macchiato"`).
   - Tap **Generate Aggregated QR** to lock in the tabletop Standee.
   - In the **Customer Simulator** on the right, select whether to pay with **USDC** or **XLM (Swap)**.
   - Tap **Confirm & Sign Payment** and approve the transaction in Freighter.
   - Within 3-5 seconds, the tabletop terminal will flash **PAYMENT CONFIRMED! 🎉** and automatically record the transaction in the sales book below.
   - Tap **Export Statements (.CSV)** to download your instantly reconciled ledger report!

## License
This project is licensed under the MIT License - see the LICENSE file for details.
