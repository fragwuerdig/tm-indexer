import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { AnyValueFilter, Assigner, EntityBase, EntityFactory, EntityI, JsonAssigner, ValueHasJsonFieldsFilter } from "./EntityI";

@Entity()
export class RecvPacketTransfer extends EntityBase {

    constructor() {
        super(
            undefined,
            [
                new AnyValueFilter("recv_packet", "packet_data"),
                new ValueHasJsonFieldsFilter("recv_packet", "packet_data", ["amount", "denom", "sender", "receiver"]),
            ],
            [
                new Assigner("message", "sender", "relayer"),
                new JsonAssigner("recv_packet", "packet_data", ["amount", "denom", "sender", "receiver"]),
                new Assigner("recv_packet", "packet_src_port", "src_port"),
                new Assigner("recv_packet", "packet_src_channel", "src_channel"),
                new Assigner("recv_packet", "packet_dst_port", "dest_port"),
                new Assigner("recv_packet", "packet_dst_channel", "dest_channel"),
                new Assigner("recv_packet", "packet_sequence", "sequence"),
            ],
        )
    }

    @Column()
    relayer!: string;

    @Column()
    amount!: string;

    @Column()
    denom!: string;

    @Column()
    sender!: string;

    @Column()
    receiver!: string;

    @Column()
    src_port!: string;
    
    @Column()
    src_channel!: string;

    @Column()
    dest_port!: string;
    
    @Column()
    dest_channel!: string;

    @Column()
    sequence!: string;

}

export class RecvPacketTransferFactory implements EntityFactory {
    create(): RecvPacketTransfer {
        return new RecvPacketTransfer();
    }
}