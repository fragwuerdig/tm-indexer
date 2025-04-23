import { DataSource } from "typeorm";
import { Data } from "ws";
import { TxItem } from "./entities/TxItem";
import { EntityBase, EntityFactory } from "./entities/EntityI";
import { ENTITIES } from "./indexer";
import { resolve } from "path";

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
}

export class TxProcessor {

    private dataSource: DataSource;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    async getUnprocessedTxs(page: number = 1): Promise<TxItem[]> {
        const txItemRepository = this.dataSource.getRepository(TxItem);
        const unprocessedTxs = await txItemRepository.find({
            where: { processed: false },
            order: { height: "ASC" },
            take: page,
        });
        return unprocessedTxs;
    }

    extractMessages(events: Event[]): Message[] {
        var msgs = new Map<number, Message>();
        for (const event of events) {
            if (event.attributes) {
                let found = event.attributes.find((a: Attribute) => {
                    return a.key === 'msg_index'
                })
                if (!found) {
                    continue;
                }
                let isActionEvent = event.type === 'message' && event.attributes.find((a: Attribute) => a.key === 'action');
                let messageAction = ''
                let messageSender = ''
                if (isActionEvent) {
                    messageAction = event.attributes.find((a: Attribute) => a.key === 'action')?.value || '';
                    messageSender = event.attributes.find((a: Attribute) => a.key === 'sender')?.value || '';
                }
                let index = parseInt(found.value, 10);
                let eventsLoc: Message = msgs.get(index) || {
                    type: messageAction,
                    sender: messageSender,
                    index: index,
                    time: new Date(),
                    events: []
                };
                eventsLoc.events.push(event);
                msgs.set(index, eventsLoc);
            }
        }
        return Array.from(msgs.values());
    }

    async handleTx(tx: TxItem) {
        const events = tx.getTxEvents();
        const msgs = this.extractMessages(events);
        const extendendMsgs = msgs.map((msg: Message) => {
            const txHash = tx.hash
            msg.tx = txHash;
            msg.time = tx.time;
            return msg;
        });
        const proms = extendendMsgs.map((msg: Message) => {
            return this.handleMsg(msg);
        });
        return await Promise.all(proms);
    }

    async handleMsg(msg: Message) {
        const promises = ENTITIES
            .filter((entityFactory: EntityFactory) => {
                const entity = entityFactory.create();
                // filter by msg_type
                if ( msg.type !== entity.msg_type ) {
                    return false;
                }
                // filter by custom filters
                if ( entity.filters.length > 0 ) {
                    for ( const filter of entity.filters ) {
                        let isFilterOk = filter.filter(msg);
                        if ( !isFilterOk ) {
                            return false;
                        }
                    }
                }
                return true;
            })
            .map((entityFactory: EntityFactory) => {
                const entity = entityFactory.create();
                // assign values to entity
                entity.assignValues(msg);

                // save entity to database
                return this.dataSource.manager.save(entity);
            })
        return await Promise.all(promises);
    }

    async run() {
        while (true) {

            // Fetch unprocessed txs
            const txs = await this.getUnprocessedTxs();
            if (txs.length == 0) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // handle each tx
            const tx = txs[0];
            try {
                await this.handleTx(tx);
            } catch (error) {
                console.error("Error processing tx: ", error);
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            
            // mark tx as processed
            tx.processed = true;
            try {
                await this.dataSource.manager.save(tx);
            } catch (error) {
                console.error("Error saving tx: ", error);
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
        }
    }

}