
import { DataSource } from 'typeorm';
import { BlockFetcher } from './worker/BlockFetcher';
import { TxFetcher } from './worker/TxFetcher';
import winston from 'winston';
import { TxProcessor } from "./worker/TxProcessor";
import dotenv from 'dotenv';
import { RecvPacketTransferFactory } from './entities/IbcRecvPacketTransfer';
import { SendPacketTransferFactory } from './entities/IbcSendPacketTransfer';
import { AcknowledgePacketFactory } from './entities/IbcAcknowledgePacket';
import { TimeoutPacketFactory } from './entities/IbcTimeoutPacket';

import { CHAIN_IDS } from './misc/gobal';
import { IbcChannelIndexer } from './worker/IbcChannelIndexer';

// define the to be indexed entities here
export const ENTITIES = [
    new RecvPacketTransferFactory(),
    new SendPacketTransferFactory(),
    new AcknowledgePacketFactory(),
    new TimeoutPacketFactory(),
]

class TerminalOutput {

    private blockFetchers:  BlockFetcher[];
    private txFetcher: TxFetcher;
    private logger: winston.Logger;
    private running: boolean = false;

    constructor(blockFetchers: BlockFetcher[], txFetcher: TxFetcher, logger: winston.Logger) {
        this.blockFetchers = blockFetchers;
        this.txFetcher = txFetcher;
        this.logger = logger;
    }

    async update() {
        for ( const blockFetcher of this.blockFetchers ) {
            //this.logger.info(`[${blockFetcher.chainId}] Fetched Blocks: ${await blockFetcher.getLatestFetchedBlockHeight()} / ${blockFetcher.latestNetworkHeight}`);
            this.logger.info(`[${blockFetcher.chainId}] Processed Txs: ${await this.txFetcher.getNumProcessedTxs()} / ${await this.txFetcher.getNumTxs()}`);
        }
    }

    async run () {
        this.running = true;
        while (this.running) {
            await this.update();
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    stop() {
        this.running = false;
    }


}

const main = async() => {

    dotenv.config();

    if (!process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
        console.error("Please set the DB_HOST, DB_PORT, DB_USER, DB_PASS and DB_NAME environment variables");
        process.exit(1);
    }

    const dataSource = new DataSource({
        type: "postgres",
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        synchronize: true,
        logging: false,
        entities: ["src/entities/!(EntityI).ts"],
    });

    const blockFetchers = CHAIN_IDS.map(chainId => new BlockFetcher(dataSource, chainId));
    const txFetcher = new TxFetcher(dataSource);
    const txProcessor = new TxProcessor(dataSource);
    const channelIndexer = new IbcChannelIndexer(dataSource);
    const terminal = new TerminalOutput(blockFetchers, txFetcher, winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.simple()
        ),
        transports: [
            new winston.transports.Console()
        ]
    }));
    
    await dataSource.initialize()

    let blockFetcherPromises = blockFetchers.map(blockFetcher => blockFetcher.run());
    let txFetcherPromise = txFetcher.run();
    let txProcessorPromise = txProcessor.run();
    let terminalPromise = terminal.run();
    let channelIndexerPromise = channelIndexer.run();

    process.on('SIGINT', async () => {
        console.log('Gracefully shutting down...');
        blockFetchers.forEach(blockFetcher => blockFetcher.stop());
        txFetcher.stop();
        txProcessor.stop();
        terminal.stop();
        channelIndexer.stop();
        await Promise.all([...blockFetcherPromises, txFetcherPromise, txProcessorPromise, terminalPromise, channelIndexerPromise]);
        await dataSource.destroy();
        process.exit(0);
    });

}

main()