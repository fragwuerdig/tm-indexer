
const CHAINS: Record<string, {rpcUrl: string, startHeight: number}> = {
    "columbus-5": {
        rpcUrl : "https://tc-rpc.luncgoblins.com",
        startHeight: 24203675
    },
    "osmosis-1": {
        rpcUrl : "https://osmo-rpc.luncgoblins.com",
        startHeight: 39854281
    }
}

export function getChainRpcUrl(chainId: string): string {
    return CHAINS[chainId]?.rpcUrl || "";
}

export function getChainStartHeight(chainId: string): number {
    return CHAINS[chainId]?.startHeight || 1;
}