import { DataSource, MoreThan } from "typeorm";
import { RPC_URL } from "./gobal";
import { BlockItem } from "./entities/BlockItem";
import { TxItem } from "./entities/TxItem";
import axios from "axios";
import { get } from "http";

export class TxFetcher {

    dataSource: DataSource;
    latestNetworkHeight: number = 0;
    latestBlock: number = 0;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    async getUnprocessedBlocks(page: number = 2): Promise<BlockItem[]> {
        const blockItemRepository = this.dataSource.getRepository(BlockItem);
        const unprocessedBlocks = await blockItemRepository.find({
            where: { processed: false, num_txs: MoreThan(0) },
            order: { height: "ASC" },
            take: page,
        });
        return unprocessedBlocks;
    }

    async markBlocksAsProcessed(heights: BlockItem[]) {
        const blockItemRepository = await this.dataSource.getRepository(BlockItem);
        const prom = heights.map((item) => {
            blockItemRepository.update({ height: item.height }, { processed: true })
        })
        const res = await Promise.all(prom)
    }

    async saveTxs(txs: TxItem[]) {
        await this.dataSource
        	.createQueryBuilder()
                .insert()
                .into(TxItem)
                .values(txs)
                .orIgnore()
                .execute();
    }

    async getNumProcessedTxs(): Promise<number> {
        const blockItemRepository = this.dataSource.getRepository(TxItem);
        const unprocessedTxs = await blockItemRepository.count({where: { processed: true }});
        return unprocessedTxs;
    }

    async getNumTxs(): Promise<number> {
        const blockItemRepository = this.dataSource.getRepository(TxItem);
        const unprocessedTxs = await blockItemRepository.count();
        return unprocessedTxs;
    }
 
    async getTxsByHeight(blockItem: BlockItem): Promise<TxItem[]> {
        //https://tmrpc.vscblockchain.org/tx_search?query=%22redeem_token_packet.success=%27true%27%20AND%20tx.height=413480%22
        const res = await axios.get(`${RPC_URL}/tx_search?query=%22tx.height=${blockItem.height}%22`);
        const txs = res.data.result.txs;
        const txsMapped = txs.map((tx: any) => {
            const txItem = new TxItem()
            txItem.hash = tx.hash
            txItem.height = Number(tx.height)
            txItem.time = new Date(blockItem.time)
            txItem.tx_result = JSON.stringify(tx.tx_result)
            return txItem
        })
        return txsMapped
    }

    async run() {
        while (true) {
            const timeout = new Promise(resolve => setTimeout(resolve, 80));
            
            // get unprocessed blocks
            const blocks = await this.getUnprocessedBlocks()
            if (blocks.length == 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            // get txs by height
            let txs;
            const txProm = blocks.map((item) => {
                return this.getTxsByHeight(item)
            })
            try {
                txs = await Promise.all(txProm)
            } catch (e) {
                console.error("Error: ", e)
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            // save txs to db
            const flattenedTxs = txs.flat();
            try {
                await this.saveTxs(flattenedTxs)
            }
            catch (e) {
                console.error("Error: ", e)
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            // mark blocks as processed
            try {
                await this.markBlocksAsProcessed(blocks);
            } catch (e) {
                console.error("Error: ", e)
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            // throttle
            await timeout;
            this.latestBlock = blocks[blocks.length - 1].height;
        }
    }

}
