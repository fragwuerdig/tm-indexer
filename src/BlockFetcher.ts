import { DataSource } from "typeorm";
import { RPC_URL } from "./gobal";
import { BlockItem } from "./entities/BlockItem";
import axios from "axios";

export class BlockFetcher {

    dataSource: DataSource;
    latestNetworkHeight: number = 0;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
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
        const [blockRes] = await Promise.all([
          axios.get(`${RPC_URL}/block?height=${height}`)
        ]);
        var block = new BlockItem();
        block.height = height;
        block.time = blockRes.data.result.block.header.time;
        block.num_txs = blockRes.data.result.block.data.txs.length;
        if ( block.num_txs == 0 ) {
            block.processed = true;
        }
        return block;
    }

    async getLatestFetchedBlockHeight(): Promise<number> {
        const blockItemRepository = this.dataSource.getRepository(BlockItem);
        const latestBlock = await blockItemRepository.findOne({
            where: {},
            order: { height: "DESC" },
        });
        if (latestBlock) {
            return latestBlock.height;
        } else {
            return 1;
        }
    }

    async trackLatestNetworkHeight() {
        while (true) {
            const res = await axios.get(`${RPC_URL}/status`);
            const height = res.data.result.sync_info.latest_block_height;
            this.latestNetworkHeight = parseInt(height, 10);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    async run() {
        this.trackLatestNetworkHeight();
        //await this.dataSource.initialize();
        var latestKnownHeight = await this.getLatestFetchedBlockHeight();
        while (true) {
            const timeout = new Promise(resolve => setTimeout(resolve, 25)); 
            
            // check if there are new blocks
            if (this.latestNetworkHeight <= latestKnownHeight) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            
            // fetch new blocks
            let block: BlockItem;
            try {
                block = await this.fetchBlock(latestKnownHeight);
            } catch (error) {
                console.error(`Error fetching block ${latestKnownHeight}:`, error);
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            // save new block to db
            try {
                await this.saveBlock(block);
            } catch (error) {
                console.error(`Error saving block ${latestKnownHeight}:`, error);
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }
            
            // throttle
       	    await timeout;
            latestKnownHeight++;
	}
    }

}
