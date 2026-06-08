import {
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Memo,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, USDC_ISSUER } from './stellar';

export type AssetCode = 'XLM' | 'USDC';

/** Build an unsigned classic payment transaction and return its XDR. */
export async function buildPaymentXDR(
  sender: string,
  destination: string,
  amount: string,
  assetCode: AssetCode,
  memoText?: string,
): Promise<string> {
  const asset =
    assetCode === 'XLM' ? Asset.native() : new Asset('USDC', USDC_ISSUER);

  // Always load the account fresh so we have the current sequence number.
  const account = await server.getAccount(sender);

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (memoText) {
    builder.addMemo(Memo.text(memoText.slice(0, 28))); // Memo text has a 28-byte limit
  }

  const tx = builder
    .addOperation(Operation.payment({ destination, asset, amount }))
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

/** Build an unsigned Path Payment transaction (XLM -> USDC) and return its XDR. */
export async function buildPathPaymentXDR(
  sender: string,
  destination: string,
  destAmount: string,
  sendMax: string,
  memoText?: string,
): Promise<string> {
  if (!USDC_ISSUER) throw new Error('USDC issuer is not configured');

  const sendAsset = Asset.native();
  const destAsset = new Asset('USDC', USDC_ISSUER);

  const account = await server.getAccount(sender);

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (memoText) {
    builder.addMemo(Memo.text(memoText.slice(0, 28))); // Memo text has a 28-byte limit
  }

  const tx = builder
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax,
        destination,
        destAsset,
        destAmount,
        path: [], // Direct XLM -> USDC conversion on DEX
      })
    )
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

/** Submit a Freighter-signed XDR. Returns the transaction hash. */
export async function submitSignedXDR(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const res = await server.sendTransaction(tx);
  if (res.status === 'ERROR') {
    throw new Error(`Submit rejected: ${JSON.stringify(res.errorResult ?? res)}`);
  }
  return res.hash;
}

/**
 * Poll until the transaction reaches finality.
 * `sendTransaction` returning PENDING is NOT success — you must poll.
 */
export async function pollTransaction(hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await server.getTransaction(hash);
    if (res.status !== 'NOT_FOUND') {
      if (res.status === 'SUCCESS') return;
      throw new Error(`Transaction ${res.status}`);
    }
  }
  throw new Error('Transaction timed out after 60s');
}
