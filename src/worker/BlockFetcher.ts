

import { DataSource } from "typeorm";
import { BlockItem } from "../entities/BlockItem";
import axios from "axios";
import { getChainRpcUrl, getChainStartHeight } from "../misc/config";

export class BlockFetcher {
    dataSource: DataSource;
    chainId: string;
    latestNetworkHeight = 0;
    running = false;
    agent: any;

    constructor(dataSource: DataSource, chainId: string, agent: any) {
        this.dataSource = dataSource;
        this.chainId = chainId;
        this.agent = agent;
    }

    private async fetchNetworkHeight(): Promise<number> {
        console.log(`BlockFetcher ${this.chainId}: fetching network height...`);
        const res = await axios.get(`${getChainRpcUrl(this.chainId)}/status`, { httpsAgent: this.agent });
        return parseInt(res.data.result.sync_info.latest_block_height, 10);
    }

    private async fetchBlock(height: number): Promise<BlockItem> {
        const [blockRes, resultRes] = await Promise.all([
            axios.get(`${getChainRpcUrl(this.chainId)}/block?height=${height}`, { httpsAgent: this.agent }),
            axios.get(`${getChainRpcUrl(this.chainId)}/block_results?height=${height}`, { httpsAgent: this.agent }),
        ]);

        const b = new BlockItem();
        b.height = height;
        b.time = blockRes.data.result.block.header.time;
        b.num_txs = blockRes.data.result.block.data.txs.length;
        b.chain_id = this.chainId;
        b.hash = blockRes.data.result.block_id.hash;
        b.processed = b.num_txs === 0;
        return b;
    }

    private async saveBlock(block: BlockItem) {
        const repo = this.dataSource.getRepository(BlockItem);
        await repo
            .createQueryBuilder()
            .insert()
            .into(BlockItem)
            .values(block)
            .orIgnore()
            .execute();
    }

    private async constructListOfBlocksToFetch(
        latestNetworkHeight: number,
        batchSize: number
    ): Promise<number[]> {
        const repo = this.dataSource.getRepository(BlockItem);

        let end = latestNetworkHeight;
        const missing: number[] = [];

        while (missing.length < batchSize && end > getChainStartHeight(this.chainId)) {
            const start = Math.max(getChainStartHeight(this.chainId), end - batchSize + 1);

            // Kandidaten in diesem Fenster
            const fetchCandidates = Array.from({ length: end - start + 1 }, (_, i) => end - i);

            // Vorhandene Höhen in diesem Fenster lesen
            const existingHeightsRaw = await repo
                .createQueryBuilder("b")
                .select("b.height", "height")
                .where("b.chain_id = :chain", { chain: this.chainId })
                .andWhere("b.height BETWEEN :min AND :max", { min: start, max: end })
                .getRawMany();

            const existing = new Set(existingHeightsRaw.map((r: any) => Number(r.height)));

            // Fehlende ergänzen
            for (const h of fetchCandidates) {
                if (!existing.has(h)) missing.push(h);
                if (missing.length >= batchSize) break;
            }

            end = start - 1; // nächstes Fenster nach unten
        }

        return missing;
    }

    async run(batchSize = 100) {

        console.log(`BlockFetcher ${this.chainId}: in run loop...`);
        this.running = true;

        console.log(`BlockFetcher ${this.chainId}: starting run loop...`);

        while (this.running) {
            try {
                console.log(`BlockFetcher ${this.chainId}: Fetching batch...`);
                const newNetworkHeight = await this.fetchNetworkHeight();

                const toFetch = await this.constructListOfBlocksToFetch(
                    newNetworkHeight,
                    batchSize
                );
                console.log(`BlockFetcher ${this.chainId}: Network height: ${newNetworkHeight}, Local height: ${await this.getLatestLocalHeight()}, Blocks to fetch: ${toFetch.length}, Earliest to fetch: ${toFetch.length > 0 ? Math.min(...toFetch) : 'N/A'} `);

                if (toFetch.length > 0) {
                    await Promise.all(
                        toFetch.map(async (h) => {
                            try {
                                const b = await this.fetchBlock(h);
                                await this.saveBlock(b);
                            } catch (err) {
                                console.error(`Fetch error ${h}:`, err);
                            }
                        })
                    );
                }

                await new Promise((r) => setTimeout(r, 5000));
            } catch (err) {
                console.error("Batch iteration failed:", err);
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
        return true;
    }


    private async getOldestLocalHeight(): Promise<number | null> {
        const repo = this.dataSource.getRepository(BlockItem);
        const res = await repo
            .createQueryBuilder("b")
            .select("MIN(b.height)", "min")
            .where("b.chain_id = :chain", { chain: this.chainId })
            .getRawOne();
        return res.min ? parseInt(res.min, 10) : null;
    }

    private async getLatestLocalHeight(): Promise<number> {
        const repo = this.dataSource.getRepository(BlockItem);
        const res = await repo
            .createQueryBuilder("b")
            .select("MAX(b.height)", "max")
            .where("b.chain_id = :chain", { chain: this.chainId })
            .getRawOne();
        return res.max ? parseInt(res.max, 10) : getChainStartHeight(this.chainId);
    }


    stop() {
        this.running = false;
    }
}
