import { useEffect, useState } from "react";
import type { Holding, Security } from "./domain/models";
export interface LedgerTransaction {
  id: string;
  account_id: string;
  account: string;
  timestamp: string;
  ticker: string | null;
  type: string;
  quantity_micros: number;
  price_micros: number;
  amount_cents: number;
  fees_cents: number;
}
export interface AlertRule {
  id: string;
  kind: string;
  ticker: string | null;
  threshold: number;
  state: number;
  enabled: number;
}
export interface PortfolioState {
  user: { id: string; kind: "demo" | "private"; email: string | null };
  accounts: { id: string; name: string; currency: string }[];
  holdings: (Holding & {
    priced: boolean;
    quoteMode: string;
    quoteTimestamp: string | null;
    basis: number;
    realised: number;
  })[];
  cash: number;
  total: number;
  invested: number;
  profit: number;
  daily: number;
  complete: boolean;
  dailyComplete: boolean;
  realised: number;
  income: number;
  fees: number;
  netFlow: number;
  watchlist: (Security & {
    price: number | null;
    dayChange: number | null;
    quoteMode: string;
    quoteTimestamp: string | null;
  })[];
  alerts: AlertRule[];
  notifications: {
    id: string;
    message: string;
    created_at: string;
    read: number;
  }[];
  transactions: LedgerTransaction[];
  settings: {
    currency: string;
    timezone: string;
    theme: string;
    refreshMinutes: number;
    notifications: boolean;
    dailyBriefing: boolean;
    briefingHour: number;
  };
  market: {
    configured: boolean;
    provider: string | null;
    mode: string;
    lastUpdated: string | null;
  };
  broker: {
    configured: boolean;
    connection: {
      provider: string;
      environment: string;
      enabled: number;
      synced_at: string;
      positions_json: string;
      balances_json: string;
    } | null;
  };
  jobs: {
    job: string;
    last_attempt: string | null;
    last_success: string | null;
    error: string | null;
  }[];
  aiConfigured: boolean;
  risk: {
    sectors: Record<string, number>;
    largest: { ticker: string; weight: number } | null;
    technology: number;
    cashWeight: number;
  };
  contributions: {
    ticker: string;
    unrealised: number | null;
    day: number | null;
    contribution: number | null;
  }[];
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Folio-Client": "1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload as T;
}
let initial: Promise<PortfolioState> | null = null;
function initialize() {
  if (!initial)
    initial = (async () => {
      const session = await api<{ user: unknown }>("/auth/session");
      if (!session.user) await api("/auth/demo", "POST", {});
      return api<PortfolioState>("/state");
    })().catch((e) => {
      initial = null;
      throw e;
    });
  return initial;
}
export function usePortfolio() {
  const [data, setData] = useState<PortfolioState | null>(null);
  const [error, setError] = useState("");
  async function reload() {
    const state = await api<PortfolioState>("/state");
    setData(state);
    setError("");
  }
  useEffect(() => {
    let active = true;
    initialize()
      .then((state) => {
        if (active) setData(state);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return { data, error, reload };
}
