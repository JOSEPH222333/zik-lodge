import { AgentWallet, CommissionMode } from "./types.js";

export function computeCommission(amount: number, settings: { mode: CommissionMode; value: number }) {
  return settings.mode === "fixed" ? settings.value : Math.round((amount * settings.value) / 100);
}

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
