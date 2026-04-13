// Arcscan (Blockscout) API helpers for Arc Testnet
const BASE_URL = "https://testnet.arcscan.app/api/v2";

export interface ArcscanTokenBalance {
  token: {
    address_hash: string;
    decimals: string;
    holders_count: string;
    name: string;
    symbol: string;
    total_supply: string;
    type: string;
    icon_url: string | null;
  };
  value: string;
}

export interface ArcscanTransaction {
  hash: string;
  block_number: number;
  timestamp: string;
  from: { hash: string };
  to: { hash: string } | null;
  value: string;
  method: string | null;
  status: string;
  fee: { value: string };
  decoded_input?: {
    method_call: string;
    method_id: string;
    parameters: Array<{ name: string; type: string; value: string }>;
  };
}

export interface ArcscanTokenTransfer {
  block_hash: string;
  from: { hash: string };
  to: { hash: string };
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: string;
    type: string;
  };
  total: { value: string; decimals: string };
  tx_hash: string;
  timestamp: string;
  type: string;
  method: string | null;
}

export async function fetchTokenBalances(address: string): Promise<ArcscanTokenBalance[]> {
  try {
    const res = await fetch(`${BASE_URL}/addresses/${address}/token-balances`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchAddressTransactions(
  address: string,
  params?: { filter?: string }
): Promise<ArcscanTransaction[]> {
  try {
    const query = params?.filter ? `?filter=${params.filter}` : "";
    const res = await fetch(`${BASE_URL}/addresses/${address}/transactions${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function fetchTokenTransfers(
  tokenAddress: string,
  params?: { type?: string }
): Promise<ArcscanTokenTransfer[]> {
  try {
    const query = params?.type ? `?type=${params.type}` : "";
    const res = await fetch(`${BASE_URL}/tokens/${tokenAddress}/transfers${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function fetchTokenInfo(tokenAddress: string) {
  try {
    const res = await fetch(`${BASE_URL}/tokens/${tokenAddress}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTokenHolders(tokenAddress: string) {
  try {
    const res = await fetch(`${BASE_URL}/tokens/${tokenAddress}/holders`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function fetchContractLogs(
  address: string,
  topic0?: string
): Promise<any[]> {
  try {
    // Fetch ALL logs for the address — Arcscan doesn't support topic0 query param
    const res = await fetch(`${BASE_URL}/addresses/${address}/logs`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];

    // Filter client-side by topic0 if specified
    if (topic0) {
      return items.filter(
        (log: any) =>
          log.topics &&
          log.topics[0] &&
          log.topics[0].toLowerCase() === topic0.toLowerCase()
      );
    }
    return items;
  } catch {
    return [];
  }
}

// Format address for display
export function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-3)}`;
}

// Explorer link helpers
export function txLink(hash: string): string {
  return `https://testnet.arcscan.app/tx/${hash}`;
}

export function addressLink(address: string): string {
  return `https://testnet.arcscan.app/address/${address}`;
}

export function tokenLink(address: string): string {
  return `https://testnet.arcscan.app/token/${address}`;
}
