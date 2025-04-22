import { BankTransferFactory } from './entities/BankTransfer';
import { DataSource } from 'typeorm';
import { BlockFetcher } from './BlockFetcher';
import { TxFetcher } from './TxFetcher';
import term from 'terminal-kit';
import { TxProcessor } from "./TxProcessor";
import { RecvRedeemPacketFactory } from './entities/RecvRedeemPacket';
import { EthereumTx, EthereumTxFactory } from './entities/EthereumTx';
import { RecvRedeemAckFactory } from './entities/RecvRedeemAck';
import dotenv from 'dotenv';



// define the to be indexed entities here
export const ENTITIES = [
    new BankTransferFactory(),
    new RecvRedeemPacketFactory(),
    new EthereumTxFactory(),
    new RecvRedeemAckFactory(),
]

class TerminalOutput {

    private blockFetcher: BlockFetcher;
    private txFetcher: TxFetcher;
    private terminal: any;
    
    constructor(blockFetcher: BlockFetcher, txFetcher: TxFetcher) {
        this.blockFetcher = blockFetcher;
        this.txFetcher = txFetcher;
        this.terminal = term.createTerminal();
    }

    async update() {
        const latestFetchedBlockHeight = await this.blockFetcher.getLatestFetchedBlockHeight()
        const numProcessed = await this.txFetcher.getNumProcessedTxs()
        const numTxs = await this.txFetcher.getNumTxs()
        this.terminal.clear();
        this.terminal.moveTo(1, 1)
            .green('Fetched Blocks: ')
            .green( latestFetchedBlockHeight )
            .green(' / ')
            .green( this.blockFetcher.latestNetworkHeight )
        this.terminal.moveTo(1, 2)
            .green('Processed Txs: ')
            .green( numProcessed )
            .green(' / ')
            .green( numTxs)
    }

    async run () {
        while (true) {
            const prom = new Promise(resolve => setTimeout(resolve, 1000));
            await this.update();
            await prom;
        }
    }


}

const main = async() => {

    await dotenv.config();

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
    
    const blockFetcher = new BlockFetcher(dataSource)
    const txFetcher = new TxFetcher(dataSource)
    const txProcessor = new TxProcessor(dataSource)
    const terminal = new TerminalOutput(blockFetcher, txFetcher);
    
    await dataSource.initialize()
    
    blockFetcher.run()
    txFetcher.run()
    txProcessor.run()
    terminal.run()

}

main()
