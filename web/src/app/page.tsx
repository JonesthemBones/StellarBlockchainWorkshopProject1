'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Horizon } from '@stellar/stellar-sdk';
import {
  fetchBalances,
  fetchVendorPayments,
  type Balances,
  type VendorPayment,
} from '@/lib/balances';
import {
  buildPaymentXDR,
  buildPathPaymentXDR,
  submitSignedXDR,
  pollTransaction,
} from '@/lib/payment';
import { downloadCSVStatement } from '@/lib/csv';
import {
  fundTestnetAccount,
  USDC_ISSUER,
  NETWORK_PASSPHRASE,
  HORIZON_URL,
} from '@/lib/stellar';
import { buildAddUsdcTrustlineXDR } from '@/lib/trustline';
import { signAndSubmit } from '@/lib/sign';
import SavingsGoal from '@/components/SavingsGoal';

// Constant exchange rate for PHP to USDC (Stablecoin pegged to USD)
const PHP_USD_RATE = 56.0;

export default function Home() {
  const wallet = useWallet();
  const { publicKey, connect, disconnect, connecting } = wallet;

  // Vendor State
  const [vendorName, setVendorName] = useState('Sari-Sari Digital');
  const [balances, setBalances] = useState<Balances | null>(null);
  const [hasTrustline, setHasTrustline] = useState(false);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // POS / Terminal State
  const [phpAmount, setPhpAmount] = useState('');
  const [itemMemo, setItemMemo] = useState('');
  const [invoiceActive, setInvoiceActive] = useState(false);
  const [invoiceUsdc, setInvoiceUsdc] = useState('0.00');
  const [invoiceMemo, setInvoiceMemo] = useState('');

  // Terminal Status & Watcher
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'waiting' | 'paid' | 'error'>('idle');
  const [paidTxHash, setPaidTxHash] = useState('');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Customer Simulator State
  const [simPayMethod, setSimPayMethod] = useState<'usdc' | 'xlm_path'>('usdc');
  const [simStatus, setSimStatus] = useState<'idle' | 'building' | 'signing' | 'submitting' | 'polling' | 'success' | 'error'>('idle');
  const [simError, setSimError] = useState('');
  const [simTxHash, setSimTxHash] = useState('');

  // Refresh vendor profile, balances, and trustlines
  const refreshVendorData = useCallback(async () => {
    if (!publicKey) return;
    setLoadingBalances(true);
    try {
      // Fetch balances
      const bal = await fetchBalances(publicKey);
      setBalances(bal);

      if (bal.funded) {
        // Fetch trustline status directly
        const horizon = new Horizon.Server(HORIZON_URL);
        const account = await horizon.loadAccount(publicKey);
        const hasUSDC = account.balances.some(
          (b) =>
            (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') &&
            b.asset_code === 'USDC' &&
            b.asset_issuer === USDC_ISSUER,
        );
        setHasTrustline(hasUSDC);
      } else {
        setHasTrustline(false);
      }

      // Fetch sales statements
      const payList = await fetchVendorPayments(publicKey);
      setPayments(payList);
    } catch (e) {
      console.error('Error refreshing vendor data:', e);
    } finally {
      setLoadingBalances(false);
    }
  }, [publicKey]);

  // Refresh on connect/disconnect
  useEffect(() => {
    if (publicKey) {
      refreshVendorData();
    } else {
      setBalances(null);
      setHasTrustline(false);
      setPayments([]);
    }
  }, [publicKey, refreshVendorData]);

  // POS Keypad Inputs
  const handleKeypadPress = (val: string) => {
    if (invoiceActive) return; // Lock inputs during active billing
    if (val === 'C') {
      setPhpAmount('');
    } else if (val === '.') {
      if (!phpAmount.includes('.')) {
        setPhpAmount((prev) => (prev === '' ? '0.' : prev + '.'));
      }
    } else {
      // Limit to 2 decimal places
      if (phpAmount.includes('.')) {
        const [, dec] = phpAmount.split('.');
        if (dec && dec.length >= 2) return;
      }
      setPhpAmount((prev) => prev + val);
    }
  };

  // Fund Vendor via Friendbot Faucet
  const [funding, setFunding] = useState(false);
  const handleFundAccount = async () => {
    if (!publicKey) return;
    setFunding(true);
    try {
      await fundTestnetAccount(publicKey);
      await refreshVendorData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Friendbot funding failed');
    } finally {
      setFunding(false);
    }
  };

  // Setup Trustline
  const [addingTrust, setAddingTrust] = useState(false);
  const handleAddTrustline = async () => {
    if (!publicKey) return;
    setAddingTrust(true);
    try {
      const xdr = await buildAddUsdcTrustlineXDR(publicKey);
      await signAndSubmit(xdr, publicKey);
      await refreshVendorData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Adding trustline failed');
    } finally {
      setAddingTrust(false);
    }
  };

  // Generate Tabletop Invoice QR
  const handleGenerateInvoice = () => {
    const amountNum = parseFloat(phpAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    const usdcEquiv = (amountNum / PHP_USD_RATE).toFixed(2);
    setInvoiceUsdc(usdcEquiv);
    setInvoiceMemo(itemMemo.trim() || `Bazaar Sale #${Math.floor(Math.random() * 9000) + 1000}`);
    setInvoiceActive(true);
    setTerminalStatus('waiting');
    setSimStatus('idle');
    setSimError('');
    setSimTxHash('');
  };

  // Cancel invoice
  const handleCancelInvoice = () => {
    setInvoiceActive(false);
    setTerminalStatus('idle');
    setSimStatus('idle');
  };

  // Watch for incoming payment matching invoice on-chain
  const checkPaymentOnChain = useCallback(async () => {
    if (!publicKey || !invoiceActive || terminalStatus !== 'waiting' || checkingPayment) return;
    setCheckingPayment(true);
    try {
      const recentPayments = await fetchVendorPayments(publicKey);
      // Look for a payment with the matching memo text, vendor destination, and amount
      const matched = recentPayments.find(
        (p) =>
          p.memo === invoiceMemo &&
          p.asset === 'USDC' &&
          Math.abs(parseFloat(p.amount) - parseFloat(invoiceUsdc)) < 0.01,
      );

      if (matched) {
        setPaidTxHash(matched.txHash);
        setTerminalStatus('paid');
        setInvoiceActive(false);
        setPhpAmount('');
        setItemMemo('');
        await refreshVendorData();
      }
    } catch (e) {
      console.error('Error polling for payment:', e);
    } finally {
      setCheckingPayment(false);
    }
  }, [publicKey, invoiceActive, terminalStatus, invoiceMemo, invoiceUsdc, checkingPayment, refreshVendorData]);

  // Set up polling loop when terminal is waiting
  useEffect(() => {
    if (terminalStatus === 'waiting' && invoiceActive) {
      pollingIntervalRef.current = setInterval(() => {
        checkPaymentOnChain();
      }, 3000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [terminalStatus, invoiceActive, checkPaymentOnChain]);

  // Customer Payment Simulation
  const handleSimulatePayment = async () => {
    if (!publicKey) return;
    setSimStatus('building');
    setSimError('');
    try {
      let xdr = '';
      if (simPayMethod === 'usdc') {
        // Direct USDC Payment
        xdr = await buildPaymentXDR(
          publicKey, // Customer is simulating with their own connected wallet
          publicKey, // Destination is also the vendor address (simulating single-address self-pay)
          invoiceUsdc,
          'USDC',
          invoiceMemo,
        );
      } else {
        // XLM -> USDC Path Payment
        // Mocking an exchange rate of 1 USDC = 10 XLM. We set a safe sendMax of 15 XLM per USDC.
        const sendMax = (parseFloat(invoiceUsdc) * 15.0).toFixed(7);
        xdr = await buildPathPaymentXDR(
          publicKey, // Customer
          publicKey, // Vendor
          invoiceUsdc, // Exact USDC target
          sendMax, // Max XLM willing to spend
          invoiceMemo,
        );
      }

      setSimStatus('signing');
      const freighter = await import('@stellar/freighter-api');
      const signed = await freighter.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: publicKey,
      });

      if (signed.error) {
        throw new Error(
          typeof signed.error === 'string' ? signed.error : 'Signing was rejected',
        );
      }

      setSimStatus('submitting');
      const hash = await submitSignedXDR(signed.signedTxXdr);
      setSimTxHash(hash);

      setSimStatus('polling');
      await pollTransaction(hash);
      setSimStatus('success');
    } catch (e: unknown) {
      setSimError(e instanceof Error ? e.message : 'Simulated payment failed');
      setSimStatus('error');
    }
  };

  // Format SEP-7-styled payment URI
  const sep7Uri = publicKey
    ? `web+stellar:pay?destination=${publicKey}&amount=${invoiceUsdc}&asset_code=USDC&asset_issuer=${USDC_ISSUER}&memo=${encodeURIComponent(invoiceMemo)}`
    : '';

  // Render QR Code using standard QRServer API (clean, fast, zero packages)
  const qrCodeUrl = sep7Uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=090d16&margin=10&data=${encodeURIComponent(sep7Uri)}`
    : '';

  return (
    <main className="min-h-screen w-full bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                StellarX PH Workshop
              </span>
              <span className="text-xs text-slate-400">June 2026</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
              Tabletop Vendor Payment Aggregator
            </h1>
            <p className="text-sm text-slate-400">
              Solve cash/digital wallet reconciliation with a single, unified on-chain USDC QR code.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-start md:self-center">
            {publicKey ? (
              <div className="flex items-center gap-3 rounded-lg bg-slate-800/80 p-1.5 pl-3 border border-slate-700/50">
                <div className="text-left">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Vendor Node</p>
                  <p className="font-mono text-xs text-slate-200">
                    {publicKey.slice(0, 6)}...{publicKey.slice(-6)}
                  </p>
                </div>
                <button
                  onClick={disconnect}
                  className="rounded-md bg-rose-600/20 px-3 py-1.5 text-xs font-semibold text-rose-400 border border-rose-500/30 transition-colors hover:bg-rose-600 hover:text-white"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 hover:shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {connecting ? 'Connecting Freighter...' : '🔌 Connect Vendor Wallet'}
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Panels */}
        {!publicKey ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/20 py-24 text-center">
            <div className="mx-auto max-w-md">
              <p className="mb-4 text-4xl">🏪</p>
              <h2 className="text-lg font-bold text-white">Initialize Your Bazaar Terminal</h2>
              <p className="mt-2 text-sm text-slate-400">
                To simulate a tabletop checkout terminal, connect your Freighter wallet. 
                Your single Stellar public address acts as the payment aggregator.
              </p>
              <button
                onClick={connect}
                className="mt-6 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            
            {/* LEFT / CENTER: VENDOR POS TERMINAL (7 Cols) */}
            <div className="space-y-8 lg:col-span-7">
              
              {/* Terminal Setup & Balance Strip */}
              <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bazaar Vendor Name</label>
                    <input
                      type="text"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="block w-full rounded border-0 bg-transparent p-0 text-lg font-bold text-white focus:ring-0"
                      placeholder="e.g. Sari-Sari Store"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {balances ? (
                      <div className="flex gap-4 rounded-lg bg-slate-900 px-4 py-2 border border-slate-700/30">
                        <div>
                          <p className="text-[9px] uppercase text-slate-400">Native XLM</p>
                          <p className="text-sm font-extrabold text-white">{balances.xlm}</p>
                        </div>
                        <div className="border-l border-slate-800 h-8 self-center"></div>
                        <div>
                          <p className="text-[9px] uppercase text-slate-400">USDC Balance</p>
                          <p className="text-sm font-extrabold text-emerald-400">{balances.usdc}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Loading balances...</span>
                    )}

                    <button
                      onClick={refreshVendorData}
                      disabled={loadingBalances}
                      className="rounded bg-slate-700 p-2 text-slate-300 hover:bg-slate-600 transition"
                      title="Refresh Balance"
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {/* Account Actions Warning */}
                {balances && !balances.funded && (
                  <div className="mt-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4 text-sm text-indigo-300">
                    <p className="font-semibold">⚠️ Account Not Activated</p>
                    <p className="mt-1 text-xs text-indigo-400">
                      Your testnet address needs at least 1-2 XLM on-chain to exist. Click below to request 10,000 testnet XLM.
                    </p>
                    <button
                      onClick={handleFundAccount}
                      disabled={funding}
                      className="mt-3 rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {funding ? 'Funding from Friendbot...' : '🎁 Fund via Friendbot Faucet'}
                    </button>
                  </div>
                )}

                {balances && balances.funded && !hasTrustline && (
                  <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300">
                    <p className="font-semibold">⚠️ USDC Trustline Missing</p>
                    <p className="mt-1 text-xs text-amber-400">
                      Stellar accounts cannot receive non-native assets without a registered trustline first. Enable USDC on your address.
                    </p>
                    <button
                      onClick={handleAddTrustline}
                      disabled={addingTrust}
                      className="mt-3 rounded bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {addingTrust ? 'Adding Trustline...' : '🛡️ Add USDC Trustline'}
                    </button>
                  </div>
                )}
              </div>

              {/* Point of Sale Checkout Panel */}
              <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">🏪 Cashier POS Terminal</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Keypad */}
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">PHP Sale Amount</label>
                      <div className="relative rounded-lg bg-slate-900 border border-slate-700 p-3 text-right">
                        <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-500">PHP</span>
                        <span className="text-2xl font-black text-white">{phpAmount || '0'}</span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Product / Customer Tag (On-Chain Memo)</label>
                      <input
                        type="text"
                        placeholder="e.g. 2 Croissants, Cup of Joe"
                        value={itemMemo}
                        onChange={(e) => setItemMemo(e.target.value)}
                        disabled={invoiceActive}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Numeric Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'C'].map((char) => (
                        <button
                          key={char}
                          onClick={() => handleKeypadPress(char)}
                          disabled={invoiceActive}
                          className="h-12 rounded-lg bg-slate-700 font-bold text-white transition hover:bg-slate-600 active:bg-slate-500 disabled:opacity-50 disabled:hover:bg-slate-700"
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Confirmation Box */}
                  <div className="flex flex-col justify-between rounded-lg bg-slate-900 border border-slate-700 p-5">
                    <div className="space-y-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sale Breakdown</p>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Subtotal PHP:</span>
                        <span className="font-semibold text-white">{phpAmount ? parseFloat(phpAmount).toFixed(2) : '0.00'} PHP</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Conversion Rate:</span>
                        <span className="font-semibold text-slate-300">1 USDC = {PHP_USD_RATE} PHP</span>
                      </div>

                      <div className="border-t border-slate-800 my-2"></div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-400">Settles to:</span>
                        <span className="text-xl font-black text-emerald-400">
                          {phpAmount ? (parseFloat(phpAmount) / PHP_USD_RATE).toFixed(2) : '0.00'} USDC
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Customers pay directly to your address. XLM payments are converted atomically on-chain. Zero credit-card merchant fees!
                      </p>
                    </div>

                    <button
                      onClick={handleGenerateInvoice}
                      disabled={invoiceActive || !phpAmount || parseFloat(phpAmount) <= 0 || !hasTrustline}
                      className="mt-6 w-full rounded-lg bg-emerald-600 py-3.5 font-bold text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
                    >
                      {!hasTrustline ? 'Add Trustline First' : '🛒 Generate Aggregated QR'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: TABLETOP STANDEE & CUSTOMER PAY SIMULATOR (5 Cols) */}
            <div className="space-y-8 lg:col-span-5">
              
              {/* Tabletop QR Card mockup */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-500 to-teal-700 p-[1.5px] shadow-xl shadow-teal-950/20">
                <div className="rounded-2xl bg-slate-950 p-6 text-center">
                  
                  {/* Acrylic standee head mockup */}
                  <div className="mx-auto mb-4 flex h-6 w-16 items-center justify-center rounded-full bg-slate-800 text-[9px] uppercase tracking-widest text-emerald-400 font-extrabold border border-slate-700/50">
                    Standee
                  </div>

                  <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">{vendorName}</h4>
                  <p className="text-[10px] text-slate-400">Unified Digital Checkout</p>

                  {/* Dynamic Area */}
                  {terminalStatus === 'idle' ? (
                    <div className="my-8 flex flex-col items-center justify-center py-10 text-slate-500">
                      <div className="text-4xl mb-2">📟</div>
                      <p className="text-xs">Waiting for checkout amount...</p>
                      <p className="text-[10px] mt-1 text-slate-600">Enter pricing and tap "Generate QR"</p>
                    </div>
                  ) : terminalStatus === 'waiting' ? (
                    <div className="my-6 space-y-4">
                      {/* Price Header */}
                      <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
                        <p className="text-xs text-slate-400">Scan to Pay Vendor</p>
                        <p className="text-2xl font-black text-white">{(parseFloat(phpAmount)).toFixed(2)} PHP</p>
                        <p className="text-xs font-medium text-emerald-400">≈ {invoiceUsdc} USDC</p>
                        <p className="mt-1 text-[10px] font-mono text-slate-500 truncate">Memo: {invoiceMemo}</p>
                      </div>

                      {/* QR Display */}
                      <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-white p-2">
                        {qrCodeUrl ? (
                          <img src={qrCodeUrl} alt="Stellar URI Payment QR" className="h-full w-full object-contain" />
                        ) : (
                          <div className="text-xs text-slate-900">Generating QR...</div>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-2 text-[10px] font-medium text-amber-400">
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                        Waiting for on-chain payment...
                      </div>

                      <button
                        onClick={handleCancelInvoice}
                        className="text-xs text-slate-400 underline hover:text-slate-200"
                      >
                        Cancel Invoice
                      </button>
                    </div>
                  ) : terminalStatus === 'paid' ? (
                    <div className="my-8 flex flex-col items-center justify-center rounded-2xl bg-emerald-500/10 p-6 border border-emerald-500/20 py-10 animate-fade-in">
                      <div className="text-5xl mb-4 animate-bounce">🎉</div>
                      <h5 className="text-lg font-black text-emerald-400">PAYMENT CONFIRMED!</h5>
                      <p className="mt-1 text-sm text-slate-300">Received {invoiceUsdc} USDC</p>
                      <p className="mt-1 text-xs text-slate-400">For memo: <span className="font-semibold text-slate-200">"{invoiceMemo}"</span></p>

                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${paidTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        View Statement on Ledger →
                      </a>

                      <button
                        onClick={() => setTerminalStatus('idle')}
                        className="mt-6 rounded-lg bg-emerald-600/30 px-5 py-2 text-xs font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition"
                      >
                        New Transaction
                      </button>
                    </div>
                  ) : null}

                  {/* QR Footer info */}
                  <div className="mt-4 border-t border-slate-900 pt-4 text-[9px] text-slate-500 leading-tight">
                    Accepts direct <span className="text-white font-semibold">USDC</span> or auto-exchanging <span className="text-white font-semibold">XLM Path Payments</span> from any Stellar wallet.
                  </div>
                </div>
              </div>

              {/* FLOATING CUSTOMER SIMULATOR */}
              {invoiceActive && terminalStatus === 'waiting' && (
                <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 shadow-lg animate-fade-in">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-3 mb-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200">📱 Customer Simulator</h5>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-medium text-indigo-300 border border-indigo-500/20">
                      Local SDK Signer
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-normal mb-4">
                    Ordinarily, a customer scans the tabletop standee with their mobile wallet. Since this is a local demo, you can instantly sign & submit as the customer below!
                  </p>

                  <div className="space-y-4 rounded-xl bg-slate-900 p-4 border border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Amount Due:</span>
                      <span className="font-extrabold text-white">{invoiceUsdc} USDC</span>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Customer Wallet Asset</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSimPayMethod('usdc')}
                          className={`rounded-lg py-2.5 text-xs font-bold border transition ${
                            simPayMethod === 'usdc'
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          🟢 Pay with USDC
                        </button>
                        <button
                          onClick={() => setSimPayMethod('xlm_path')}
                          className={`rounded-lg py-2.5 text-xs font-bold border transition ${
                            simPayMethod === 'xlm_path'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          🔵 Pay with XLM (Swap)
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2">
                      {simPayMethod === 'usdc' ? (
                        <span>Direct payment from your wallet. Requires USDC balance and trustline.</span>
                      ) : (
                        <span>Uses a <strong>Stellar Path Payment</strong>. You spend XLM; DEX auto-converts; Vendor gets USDC!</span>
                      )}
                    </div>

                    {/* Submit Simulation */}
                    <button
                      onClick={handleSimulatePayment}
                      disabled={simStatus !== 'idle' && simStatus !== 'error' && simStatus !== 'success'}
                      className="w-full rounded-lg bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition disabled:opacity-40"
                    >
                      {simStatus === 'idle' && '🔗 Confirm & Sign Payment'}
                      {simStatus === 'building' && '⚙️ Preparing transaction...'}
                      {simStatus === 'signing' && '🖋️ Waiting for Freighter...'}
                      {simStatus === 'submitting' && '🚀 Submitting to Stellar...'}
                      {simStatus === 'polling' && '⏱️ Confirming transaction...'}
                      {simStatus === 'success' && '✅ Payment Sent!'}
                      {simStatus === 'error' && '❌ Retrying...'}
                    </button>

                    {simStatus === 'success' && (
                      <p className="text-[10px] font-bold text-center text-emerald-400">
                        Submitted! The checkout standee is syncing...
                      </p>
                    )}

                    {simError && (
                      <div className="rounded bg-rose-500/10 border border-rose-500/20 p-2 text-[10px] text-rose-400 truncate">
                        {simError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SALES RECONCILIATION STATEMENT */}
        {publicKey && (
          <section className="mt-12 rounded-2xl bg-slate-800 border border-slate-700 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-700 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  📊 Sales Book & Reconciliation Journal
                </h3>
                <p className="text-xs text-slate-400">
                  Every received digital payment is permanently cataloged on the ledger with item-level tags.
                </p>
              </div>

              {payments.length > 0 && (
                <button
                  onClick={() => downloadCSVStatement(payments, vendorName)}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white flex items-center gap-1.5 transition self-start md:self-auto"
                >
                  📥 Export Statements (.CSV)
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No ledger records found yet. Trigger a payment from the POS Terminal to populate your cash book!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-900">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                      <th className="px-4 py-3">Date/Time</th>
                      <th className="px-4 py-3">Customer ID (Sender)</th>
                      <th className="px-4 py-3">Asset Paid</th>
                      <th className="px-4 py-3 text-right">Settled Amount</th>
                      <th className="px-4 py-3 text-right">PHP Valuation</th>
                      <th className="px-4 py-3">Itemized Memo / Tag</th>
                      <th className="px-4 py-3">Ledger Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {payments.map((p) => {
                      const date = new Date(p.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const dateFull = new Date(p.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      });
                      const isUsdc = p.asset === 'USDC';
                      const phpVal = isUsdc
                        ? (parseFloat(p.amount) * PHP_USD_RATE).toFixed(2)
                        : (parseFloat(p.amount) * 10 * PHP_USD_RATE).toFixed(2); // Mock: 10 XLM/USDC
                      
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3.5 text-slate-300">
                            <p className="font-semibold">{date}</p>
                            <p className="text-[10px] text-slate-500">{dateFull}</p>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400">
                            {p.sender.slice(0, 4)}...{p.sender.slice(-4)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                                isUsdc
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}
                            >
                              {p.asset}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-white">
                            {parseFloat(p.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-400">
                            ₱{phpVal}
                          </td>
                          <td className="px-4 py-3.5 text-slate-300 font-semibold italic">
                            "{p.memo}"
                          </td>
                          <td className="px-4 py-3.5">
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${p.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-400 hover:underline text-[10px]"
                            >
                              {p.txHash.slice(0, 6)}...{p.txHash.slice(-6)}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* SOROBAN SMART CONTRACT CONTAINER (Bonus Track) */}
        <section className="mt-12 border-t border-slate-800 pt-8">
          <details className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-slate-400 hover:text-slate-200">
              <span className="flex items-center gap-2">
                🎓 <span className="text-xs uppercase tracking-wider font-bold">Soroban Smart Contract Extension (Bonus Track)</span>
              </span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 border-t border-slate-800/60 pt-4 text-slate-300">
              <p className="text-xs text-slate-400 mb-4 leading-normal">
                If you are also presenting the Smart Contract track of the workshop, here is the deployed <strong>Savings Goal tracker</strong>. 
                Our deployment scripts auto-wire the contract ID, so you can interact with it on-chain right here.
              </p>
              <SavingsGoal publicKey={publicKey} />
            </div>
          </details>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-800/80 pt-8 text-center text-xs text-slate-500">
          <p>© 2026 Tabletop Vendor Payment Aggregator.</p>
          <p className="mt-1">
            Built for the Stellar PH Workshop @ PUP QC with ❤️. Open-source under MIT License.
          </p>
        </footer>
      </div>
    </main>
  );
}
