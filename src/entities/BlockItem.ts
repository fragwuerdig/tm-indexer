import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class BlockItem {

    @PrimaryColumn()
    height!: number;
    
    @Column()
    time!: string;
    
    @Column()
    num_txs!: number;

    @Column()
    processed: boolean = false;

};