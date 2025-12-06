// src/lib/goalUtils.js
export function formatRupiah(num = 0) {
  try {
    return new Intl.NumberFormat("id-ID").format(Number(num || 0));
  } catch {
    return String(num || 0);
  }
}

/**
 * computeWalletBalance
 * - txs: array of transactions (from supabase)
 * - walletId: the wallet id to compute saved balance for (includes income/expense & transfer handling)
 *
 * Rules:
 * - income transactions that have wallet_id === walletId increase balance
 * - expense transactions that have wallet_id === walletId decrease balance
 * - transfer transactions: if you store transfer as single-row with transfer_from/transfer_to_id:
 *     - if tx.transfer_to_id === walletId and tx.type === 'transfer' -> add amount
 *     - if tx.transfer_from === walletId and tx.type === 'transfer' -> subtract amount
 * - adapt if your transfer schema uses different fields
 */
export function computeWalletBalance(txs = [], walletId) {
  if (!walletId) return 0;

  const numeric = (v) => Number(v || 0);

  let balance = 0;

  for (const t of txs || []) {
    // standard income/expense rows (wallet_id)
    if (t.wallet_id && t.wallet_id === walletId) {
      if (t.type === "income") balance += numeric(t.amount);
      else if (t.type === "expense") balance -= numeric(t.amount);
      else if (t.type === "transfer") {
        // If transfer stored in wallet_id as expense/income pair, handle accordingly (rare)
        // We'll fallthrough to transfer_from/transfer_to_id below if present
      }
    }

    // transfer single-row schema (transfer_from / transfer_to_id)
    if (t.type === "transfer") {
      // possible field names: transfer_from, transfer_to_id, transfer_to
      if (t.transfer_to_id && t.transfer_to_id === walletId) {
        balance += numeric(t.amount);
      } else if (t.transfer_to && t.transfer_to === walletId) {
        balance += numeric(t.amount);
      }

      if (t.transfer_from && t.transfer_from === walletId) {
        balance -= numeric(t.amount);
      } else if (t.transfer_from_id && t.transfer_from_id === walletId) {
        balance -= numeric(t.amount);
      }
    }
  }

  return balance;
}

/**
 * computeETA
 * - saved: current saved amount (number)
 * - target: target amount (number)
 * - savingAmount: planned saving per period (number)
 * - frequency: 'weekly' or 'monthly'
 *
 * returns { periodsNeeded, etaLabel, unitLabel }
 * - periodsNeeded: integer number of periods (weeks or months)
 * - etaLabel: simple string like "6 bulan" or "14 minggu" or null if impossible
 * - unitLabel: 'bulan' or 'minggu'
 */
export function computeETA({
  saved = 0,
  target = 0,
  savingAmount = 0,
  frequency = "weekly",
}) {
  const numeric = (v) => Number(v || 0);
  saved = numeric(saved);
  target = numeric(target);
  savingAmount = numeric(savingAmount);

  const remaining = Math.max(0, target - saved);

  if (remaining <= 0) {
    return {
      periodsNeeded: 0,
      etaLabel: "Tercapai",
      unitLabel: frequency === "monthly" ? "bulan" : "minggu",
    };
  }

  if (savingAmount <= 0) {
    return {
      periodsNeeded: null,
      etaLabel: null,
      unitLabel: frequency === "monthly" ? "bulan" : "minggu",
    };
  }

  const raw = remaining / savingAmount;
  const periodsNeeded = Math.ceil(raw);

  const unitLabel = frequency === "monthly" ? "bulan" : "minggu";

  // We will return etaLabel as just the number + unit (no date)
  const etaLabel = `${periodsNeeded} ${unitLabel}`;

  return { periodsNeeded, etaLabel, unitLabel };
}
