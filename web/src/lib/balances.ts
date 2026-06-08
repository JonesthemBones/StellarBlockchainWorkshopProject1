import { Horizon } from '@stellar/stellar-sdk';
import { HORIZON_URL } from './stellar';

// Horizon is used for historical/account reads like balances.
const horizon = new Horizon.Server(HORIZON_URL);

export interface Balances {
  xlm: string;
  usdc: string;
  funded: boolean;
}

export interface VendorPayment {
  id: string;
  txHash: string;
  timestamp: string;
  sender: string;
  amount: string;
  asset: string;
  memo: string;
}

export async function fetchBalances(publicKey: string): Promise<Balances> {
  try {
    const account = await horizon.loadAccount(publicKey);
    let xlm = '0';
    let usdc = '0';

    for (const b of account.balances) {
      if (b.asset_type === 'native') {
        xlm = parseFloat(b.balance).toFixed(2);
      } else if (
        (b.asset_type === 'credit_alphanum4' ||
          b.asset_type === 'credit_alphanum12') &&
        b.asset_code === 'USDC'
      ) {
        usdc = parseFloat(b.balance).toFixed(2);
      }
    }
    return { xlm, usdc, funded: true };
  } catch (e: unknown) {
    // 404 = account does not exist yet (not funded).
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404 || (e as { name?: string })?.name === 'NotFoundError') {
      return { xlm: '0', usdc: '0', funded: false };
    }
    throw e;
  }
}

/** Fetch recent payments received by this vendor with their transaction memos. */
export async function fetchVendorPayments(publicKey: string): Promise<VendorPayment[]> {
  try {
    // Fetch latest payment operations
    const paymentsResponse = await horizon.payments()
      .forAccount(publicKey)
      .order('desc')
      .limit(15)
      .call();

    // Fetch latest transactions to match memos
    const txResponse = await horizon.transactions()
      .forAccount(publicKey)
      .order('desc')
      .limit(15)
      .call();

    // Map transaction hash to its text memo
    const txMemoMap = new Map<string, string>();
    for (const tx of txResponse.records) {
      if (tx.memo_type === 'text' && tx.memo) {
        txMemoMap.set(tx.hash, tx.memo);
      }
    }

    const payments: VendorPayment[] = [];
    for (const record of paymentsResponse.records) {
      // We check if it is a payment or a path payment and if it is incoming (to vendor)
      if (
        (record.type === 'payment' || record.type === 'path_payment_strict_receive') &&
        record.to === publicKey
      ) {
        // Safe cast to access payment-specific fields in Horizon response
        const pRecord = record as unknown as {
          id: string;
          transaction_hash: string;
          created_at: string;
          from: string;
          amount: string;
          asset_type: string;
          asset_code?: string;
        };

        const assetCode = pRecord.asset_type === 'native' ? 'XLM' : pRecord.asset_code;

        payments.push({
          id: pRecord.id,
          txHash: pRecord.transaction_hash,
          timestamp: pRecord.created_at,
          sender: pRecord.from,
          amount: pRecord.amount,
          asset: assetCode || 'XLM',
          memo: txMemoMap.get(pRecord.transaction_hash) || 'No Item Tag',
        });
      }
    }

    return payments;
  } catch (e) {
    console.error('Error fetching payments:', e);
    return [];
  }
}
