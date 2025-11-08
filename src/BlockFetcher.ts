/*import { DataSource } from "typeorm";
import { BlockItem } from "./entities/BlockItem";
import axios from "axios";
import { get } from "http";
import { getChainRpcUrl, getChainStartHeight } from "./config";

export class BlockFetcher {

    dataSource: DataSource;
    latestNetworkHeight: number = 0;
    chainId: string;
    running: boolean = false;

    constructor(dataSource: DataSource, chainId: string) {
        this.dataSource = dataSource;
        this.chainId = chainId;
    }

    async saveBlock(block: BlockItem) {
        const blockItemRepository = this.dataSource.getRepository(BlockItem);
        const existingBlock = await blockItemRepository.findOne({
            where: { height: block.height },
        });
        if (!existingBlock) {
            await blockItemRepository.save(block);
        }
    }

    async fetchBlock(height: number): Promise<BlockItem> {
        const [blockRes, resultRes] = await Promise.all([
          axios.get(`${getChainRpcUrl(this.chainId)}/block?height=${height}`),
          axios.get(`${getChainRpcUrl(this.chainId)}/block_results?height=${height}`)
        ]);
        var block = new BlockItem();
        block.height = height;
        block.time = blockRes.data.result.block.header.time;
        block.num_txs = blockRes.data.result.block.data.txs.length;
        block.chain_id = this.chainId;
        block.hash = blockRes.data.result.block_id.hash;
        if ( block.num_txs == 0 ) {
            block.processed = true;
        }
        return block;
    }

    async getLatestFetchedBlockHeight(): Promise<number> {
        const blockItemRepository = this.dataSource.getRepository(BlockItem);
        const latestBlock = await blockItemRepository.findOne({
            where: { chain_id: this.chainId },
            order: { height: "DESC" },
        });
        if (latestBlock) {
            return latestBlock.height;
        } else {
            return getChainStartHeight(this.chainId);
        }
    }

    async trackLatestNetworkHeight() {
        while (true) {
            const res = await axios.get(`${getChainRpcUrl(this.chainId)}/status`);
            const height = res.data.result.sync_info.latest_block_height;
            this.latestNetworkHeight = parseInt(height, 10);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    async run() {
        this.running = true;
        this.trackLatestNetworkHeight();
        //await this.dataSource.initialize();
        var latestKnownHeight = await this.getLatestFetchedBlockHeight();
        while (this.running) {
            if (this.latestNetworkHeight <= latestKnownHeight) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            const concurrency = 100;
            const promises: Promise<void>[] = [];
            for (let i = 0; i < concurrency && latestKnownHeight + i <= this.latestNetworkHeight; i++) {
                const height = latestKnownHeight + i;
                promises.push((async () => {
                    try {
                        const block = await this.fetchBlock(height);
                        await this.saveBlock(block);
                    } catch (error) {
                        console.error(`Error fetching block ${height}:`, error);
                        // Optionally handle retry logic here
                    }
                })());
            }
            await Promise.all(promises);
            latestKnownHeight += concurrency;
        }
    }

    stop() {
        this.running = false;
    }

}*/

import { DataSource } from "typeorm";
import { BlockItem } from "./entities/BlockItem";
import axios from "axios";
import { getChainRpcUrl, getChainStartHeight } from "./config";

export class BlockFetcher {
    dataSource: DataSource;
    chainId: string;
    latestNetworkHeight = 0;
    running = false;

    constructor(dataSource: DataSource, chainId: string) {
        this.dataSource = dataSource;
        this.chainId = chainId;
    }

    private async fetchNetworkHeight(): Promise<number> {
        const res = await axios.get(`${getChainRpcUrl(this.chainId)}/status`);
        return parseInt(res.data.result.sync_info.latest_block_height, 10);
    }

    private async fetchBlock(height: number): Promise<BlockItem> {
        const [blockRes, resultRes] = await Promise.all([
            axios.get(`${getChainRpcUrl(this.chainId)}/block?height=${height}`),
            axios.get(`${getChainRpcUrl(this.chainId)}/block_results?height=${height}`),
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

    async run(batchSize = 100) {
        this.running = true;

        const startHeight = getChainStartHeight(this.chainId);
        const networkHeight = await this.fetchNetworkHeight();

        // DB-Grenzen lesen
        let knownTop = await this.getLatestLocalHeight();
        let knownBottom = await this.getOldestLocalHeight();

        // Fall: keine Blöcke vorhanden -> beginne mit letztem Batch
        if (!knownBottom || knownBottom === knownTop) {
            knownTop = networkHeight;
            knownBottom = Math.max(startHeight, networkHeight - batchSize + 1);
        }

        while (this.running) {
            try {
                const newNetworkHeight = await this.fetchNetworkHeight();
                const newHeights: number[] = [];
                const oldHeights: number[] = [];

                // Neue Blöcke seit letztem Lauf
                for (let h = knownTop + 1; h <= newNetworkHeight; h++) newHeights.push(h);

                // Ältere Blöcke, falls noch Platz im Batch
                const remaining = batchSize - newHeights.length;
                if (remaining > 0 && knownBottom > startHeight) {
                    const lowerStart = Math.max(startHeight, knownBottom - remaining);
                    for (let h = knownBottom - 1; h >= lowerStart; h--) oldHeights.push(h);
                }

                const toFetch = [...newHeights, ...oldHeights];
                console.log(toFetch);

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

                    // Grenzen aktualisieren
                    if (newHeights.length) knownTop = newNetworkHeight;
                    if (oldHeights.length) knownBottom = Math.min(...oldHeights);
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
