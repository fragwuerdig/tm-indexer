import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class BlockItem {

    @PrimaryColumn()
    height!: number;

    @Column()
    hash!: string;
    
    @Column()
    time!: string;
    
    @Column()
    num_txs!: number;

    @Column()
    processed: boolean = false;

    @Column()
    chain_id!: string;

};