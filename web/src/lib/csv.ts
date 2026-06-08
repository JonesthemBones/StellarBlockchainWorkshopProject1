import { VendorPayment } from './balances';

/** Generates and triggers a client-side download of a CSV sales statement. */
export function downloadCSVStatement(payments: VendorPayment[], vendorName: string): void {
  // Define CSV columns
  const headers = [
    'Date & Time',
    'Transaction Hash',
    'Customer Address',
    'Asset Received',
    'Amount',
    'Estimated PHP (56 PHP/USD)',
    'Item Memo / Tag',
  ];

  // Map payments into CSV-safe arrays
  const rows = payments.map((p) => {
    const formattedDate = new Date(p.timestamp).toLocaleString();
    const phpEstimate = p.asset === 'USDC'
      ? (parseFloat(p.amount) * 56).toFixed(2)
      : (parseFloat(p.amount) * 10 * 56).toFixed(2); // Mock XLM estimate: 1 XLM = 0.10 USDC (10 XLM/USDC)
    
    return [
      `"${formattedDate}"`,
      `"${p.txHash}"`,
      `"${p.sender}"`,
      `"${p.asset}"`,
      `"${p.amount}"`,
      `"${phpEstimate} PHP"`,
      `"${p.memo.replace(/"/g, '""')}"`, // Escape any internal quotes
    ];
  });

  // Construct final CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  // Create downloadable Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanVendorName = vendorName.trim().replace(/\s+/g, '_') || 'Vendor';
  link.setAttribute('download', `${cleanVendorName}_reconciliation_statement_${dateStr}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
