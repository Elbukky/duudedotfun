/**
 * Parse blockchain/wallet errors into user-friendly messages.
 * Covers: user rejection, insufficient funds, slippage, graduation,
 * network errors, nonce conflicts, and generic contract reverts.
 */
export function parseTransactionError(err: any): string {
  if (!err) return "Transaction failed";

  const message = (err?.message || "").toLowerCase();
  const reason = (err?.reason || "").toLowerCase();
  const code = err?.code;

  // User rejected the transaction in wallet
  if (
    code === "ACTION_REJECTED" ||
    code === 4001 ||
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request") ||
    message.includes("user refused")
  ) {
    return "Transaction cancelled";
  }

  // Insufficient funds / balance
  if (
    message.includes("insufficient funds") ||
    message.includes("exceeds balance") ||
    reason.includes("insufficient")
  ) {
    return "Insufficient balance for this transaction";
  }

  // Slippage / price movement
  if (
    reason.includes("slippage") ||
    reason.includes("min_out") ||
    reason.includes("mintokensout") ||
    reason.includes("minusdcout") ||
    reason.includes("too much price movement") ||
    reason.includes("excessive price impact")
  ) {
    return "Price moved too much — try a smaller amount or increase slippage";
  }

  // Already graduated
  if (reason.includes("graduated") || reason.includes("already graduated")) {
    return "This token has already graduated to the DEX pool";
  }

  // Zero amount
  if (reason.includes("zero") || message.includes("amount is zero")) {
    return "Amount must be greater than zero";
  }

  // Gas estimation / execution revert
  if (
    message.includes("cannot estimate gas") ||
    message.includes("execution reverted")
  ) {
    const r = err?.reason || "";
    if (r) return r.length > 150 ? r.slice(0, 150) + "..." : r;
    return "Transaction would fail — reserves may have changed, try again";
  }

  // Network / RPC errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("disconnected") ||
    code === "NETWORK_ERROR" ||
    code === "SERVER_ERROR"
  ) {
    return "Network error — check your connection and try again";
  }

  // Nonce / replacement conflicts
  if (message.includes("nonce") || message.includes("replacement")) {
    return "Transaction conflict — please wait a moment and try again";
  }

  // Unpredictable gas limit (often means the tx would revert)
  if (message.includes("unpredictable_gas_limit")) {
    const r = err?.reason || "";
    if (r) return r.length > 150 ? r.slice(0, 150) + "..." : r;
    return "Transaction would fail — the token state may have changed";
  }

  // Contract revert with a reason string
  if (err?.reason) {
    const r: string = err.reason;
    return r.length > 150 ? r.slice(0, 150) + "..." : r;
  }

  // Generic message fallback
  const msg: string = err?.message || "Transaction failed";
  return msg.length > 150 ? msg.slice(0, 150) + "..." : msg;
}
