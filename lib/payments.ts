/**
 * Bountix payment constants.
 *
 * Direction: USDC only on Base. No custom token, no USDT.
 * Manual payment and the deployed Base mainnet escrow flow are live payment
 * paths for Bountix rewards.
 *
 * See docs/constraints.md for the full payment + free-tier rules.
 */

export const PAYMENT_TOKEN = "USDC" as const;
export type PaymentToken = typeof PAYMENT_TOKEN;

export const CHAIN_NAME = "Base" as const;
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Native USDC contract on Base mainnet (Circle-issued). */
export const BASE_MAINNET_USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** USDC has 6 decimals on every supported chain. */
export const USDC_DECIMALS = 6;

export type PaymentStatus =
  | "unpaid"
  | "funded"
  | "released"
  | "refunded"
  | "disputed";

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  funded: "Funded (escrow)",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
};

/**
 * Format a numeric USDC amount for display.
 * Always returns "<n> USDC" with thousands separator and up to 2 fraction digits.
 * Returns "0 USDC" for null/undefined/NaN.
 */
export function formatUsdc(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `0 ${PAYMENT_TOKEN}`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formatted} ${PAYMENT_TOKEN}`;
}

/**
 * True because Bountix has a deployed Base mainnet escrow contract.
 */
export const escrowOnBaseLive = true;
