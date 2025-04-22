import { Column, Entity, PrimaryColumn } from "typeorm";
import { Event } from "../TxProcessor"


@Entity()
export class TxItem {

    @PrimaryColumn()
    hash!: string;
    
    @Column()
    height!: number;
    
    @Column()
    tx_result!: string;

    @Column()
    time!: Date;

    @Column()
    processed: boolean = false;

    getTxEvents(): Event[] {
        const events = JSON.parse(this.tx_result).events;
        if (events) {
            return events as Event[];
        }
        return []
    }

};