import { AgentWallet, CommissionMode } from "./types.js";

// Supports both fixed commission fees and percentage-based marketplace revenue.
export function computeCommission(amount: number, settings: { mode: CommissionMode; value: number }) {
  return settings.mode === "fixed" ? settings.value : Math.round((amount * settings.value) / 100);
}

// Wallets are created lazily the first time an agent has commission activity.
export function getOrCreateWallet(wallets: AgentWallet[], agentId: string) {
  let wallet = wallets.find((item) => item.agentId === agentId);
  if (!wallet) {
    wallet = {
      id: `wallet_${agentId}`,
      agentId,
      totalEarnings: 0,
      pendingEarnings: 0,
      availableBalance: 0
    };
    wallets.push(wallet);
  }
  return wallet;
}
