
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
import https from "https";

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

    if (CHAIN_IDS.length === 0) {
        console.error("Please set at least one CHAIN_ID in the CHAIN_IDS array in src/misc/gobal.ts");
        process.exit(1);
    }

    const agent = new https.Agent({
        keepAlive: true,
        maxSockets: 10,
    });

    const dataSource = new DataSource({
        type: "postgres",
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        synchronize: true,
        logging: false,
        migrations: ["src/migrations/*.ts"],
        entities: ["src/entities/!(EntityI).ts"],
    });

    console.log("Initializing data source...");
    await dataSource.initialize()

    console.log("Running migrations...");
    await dataSource.runMigrations();

    console.log("Creating BlockFetchers, TxFetcher, TxProcessor and TerminalOutput...");
    const blockFetchers = CHAIN_IDS.map(chainId => new BlockFetcher(dataSource, chainId, agent));
    const txFetcher = new TxFetcher(dataSource, agent);
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

    console.log("Starting BlockFetchers, TxFetcher, TxProcessor and TerminalOutput...");
    let blockFetcherPromises = blockFetchers.map(blockFetcher => blockFetcher.run().catch((err: any) => {
        console.error(`BlockFetcher ${blockFetcher.chainId} encountered an error:`, err);
    }));
    let txFetcherPromise = txFetcher.run().catch(err => {
        console.error("TxFetcher encountered an error:", err);
    });
    let txProcessorPromise = txProcessor.run().catch(err => {
        console.error("TxProcessor encountered an error:", err);
    });
    let terminalPromise = terminal.run().catch(err => {
        console.error("TerminalOutput encountered an error:", err);
    });
    let channelIndexerPromise = channelIndexer.run().catch(err => {
        console.error("IbcChannelIndexer encountered an error:", err);
    });

    console.log("All components started.");

    process.on('SIGINT', async () => {
        console.log('Gracefully shutting down...');
        blockFetchers.forEach(blockFetcher => blockFetcher.stop());
        txFetcher.stop();
        txProcessor.stop();
        terminal.stop();
        channelIndexer.stop();
        await Promise.all([...blockFetcherPromises, txFetcherPromise, txProcessorPromise, terminalPromise, channelIndexerPromise]);
        await dataSource.destroy();
        await agent.destroy();
        process.exit(0);
    });

    await Promise.all([...blockFetcherPromises, txFetcherPromise, txProcessorPromise, terminalPromise, channelIndexerPromise]);


}

main()