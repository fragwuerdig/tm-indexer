import { DataSource } from "typeorm";
import { Data } from "ws";
import { TxItem } from "./entities/TxItem";
import { EntityFactory } from "./entities/EntityI";
import { ENTITIES } from "./indexer";

export type Event = {
    type: string;
    attributes: Attribute[];
}

export type Attribute = {
    key: string;
    value: string;
    index: boolean;
}

export type Message = {
    type: string;
    sender: string;
    tx?: string;
    time: Date;
    events: Event[];
    index: number;
    chain_id: string;
}

export class TxProcessor {

    private dataSource: DataSource;
    private running: boolean = false;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    async getUnprocessedTxs(page: number = 100): Promise<TxItem[]> {
        const txItemRepository = this.dataSource.getRepository(TxItem);
        const unprocessedTxs = await txItemRepository.createQueryBuilder("tx")
            .where("tx.processed = :processed", { processed: false })
            .orderBy("tx.time", "ASC")
            .take(page)
            .getMany();
        return unprocessedTxs;
    }

    async extractMessages(chain_id: string,events: Event[]): Promise<Message[]> {
        var msgs = new Map<number, Message>();
        var currentMsgIndex = -1;
        var currentMsgAction = '';
        var currentMsgSender = '';
        for (const event of events) {
            if (event.attributes) {
                let isActionEvent = event.type === 'message' && event.attributes.find((a: Attribute) => a.key === 'action');
                if (isActionEvent) {
                    currentMsgAction = event.attributes.find((a: Attribute) => a.key === 'action')?.value || '';
                    currentMsgSender = event.attributes.find((a: Attribute) => a.key === 'sender')?.value || '';
                    currentMsgIndex += 1;
                }

                if ( currentMsgIndex == -1 ) {
                    continue;
                }

                let eventsLoc: Message = msgs.get(currentMsgIndex) || {
                    type: currentMsgAction,
                    sender: currentMsgSender,
                    index: currentMsgIndex,
                    time: new Date(),
                    events: [],
                    chain_id: chain_id
                };
                eventsLoc.events.push(event);
                msgs.set(currentMsgIndex, eventsLoc);
            }
        }
        return Array.from(msgs.values());
    }

    async handleTx(tx: TxItem) {
        const events = tx.getTxEvents();
        const msgs = await this.extractMessages(tx.chain_id, events);
        const extendendMsgs = msgs.map((msg: Message) => {
            const txHash = tx.hash
            msg.tx = txHash;
            msg.time = tx.time;
            return msg;
        });
        extendendMsgs.forEach((msg: Message) => {
            this.handleMsg(msg);
        });
    }

    async handleMsg(msg: Message) {
        ENTITIES.forEach(async (entityFactory: EntityFactory) => {
            const entity = entityFactory.create();
            
            // filter by msg_type id (if specified)
            if ( entity.msg_type && msg.type !== entity.msg_type ) {
                return;
            }

            // filter by custom filters
            if ( entity.filters.length > 0 ) {
                for ( const filter of entity.filters ) {
                    let isFilterOk = filter.filter(msg);
                    if ( !isFilterOk ) {
                        return;
                    }
                }
            }
            
            // assign values to entity
            entity.assignValues(msg);

            // save entity to database
            await this.dataSource.manager.save(entity);
        })
    }

    async run() {
        this.running = true;
        while (this.running) {
            const txs = await this.getUnprocessedTxs(100);
            if (txs.length == 0) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            await Promise.all(
                txs.map(async (tx) => {
                    await this.handleTx(tx);
                    tx.processed = true;
                    await this.dataSource.manager.save(tx);
                })
            );
        }
        return true;
    }

    stop() {
        this.running = false;
    }

}