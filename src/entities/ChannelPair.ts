import { Column, Entity, Unique, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Event } from "../TxProcessor"


@Entity()
@Unique(["src_channel", "dest_channel", "src_port", "dest_port", "from_chain_id"])
export class ChannelPair {

    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column()
    src_channel!: string;

    @Column()
    dest_channel!: string;

    @Column()
    src_port!: string;

    @Column()
    dest_port!: string;

    @Column()
    from_chain_id!: string;
    
};