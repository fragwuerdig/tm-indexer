import { SendPacketTransfer } from '../entities/IbcSendPacketTransfer';
import { DataSource } from 'typeorm';
import { ChannelPair } from '../entities/ChannelPair';

export class IbcChannelIndexer {
    private dataSource: DataSource;
    private running: boolean = false;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    async processUnprocessedSendPacketsAndBuildChannelPairs(pageSize: number): Promise<void> {

        // retrieve the latest unprocessed SendPacketTransfers
        const unprocessedTransfers = await this.dataSource.getRepository(SendPacketTransfer).find({
            where: { processed: false },
            order: { time: 'DESC' },
            take: pageSize,
        });

        // for all of them create a new IbcFullTransferFlow
        // which represents a single IBC transfer flow with
        // all relay transactions linked to it
        for (const transfer of unprocessedTransfers) {

            // store the associated channel pair
            await this.dataSource
                .createQueryBuilder()
                .insert()
                .into(ChannelPair)
                .values({
                    src_channel: transfer.src_channel,
                    src_port: transfer.src_port,
                    dest_channel: transfer.dest_channel,
                    dest_port: transfer.dest_port,
                    from_chain_id: transfer.chain_id,
                })
                .orIgnore() // translates to ON CONFLICT DO NOTHING
                .execute();


            transfer.processed = true;
            await this.dataSource.getRepository(SendPacketTransfer).save(transfer);
        }
    }

    async run() {
        this.running = true;
        while (this.running) {
            await this.processUnprocessedSendPacketsAndBuildChannelPairs(100);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        return;
    }

    async stop() {
        this.running = false;
    }
}