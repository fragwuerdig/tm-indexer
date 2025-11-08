import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { AnyValueFilter, Assigner, EntityBase, EntityFactory, EntityI, JsonAssigner, ValueHasJsonFieldsFilter } from "./EntityI";

@Entity()
export class SendPacketTransfer extends EntityBase {

    constructor() {
        super(
            undefined,
            [
                new AnyValueFilter("send_packet", "packet_data"),
                new ValueHasJsonFieldsFilter("send_packet", "packet_data", ["amount", "denom", "sender", "receiver"]),
            ],
            [
                new JsonAssigner("send_packet", "packet_data", ["amount", "denom", "sender", "receiver"]),
                new Assigner("send_packet", "packet_src_port", "src_port"),
                new Assigner("send_packet", "packet_src_channel", "src_channel"),
                new Assigner("send_packet", "packet_dst_port", "dest_port"),
                new Assigner("send_packet", "packet_dst_channel", "dest_channel"),
                new Assigner("send_packet", "packet_sequence", "sequence"),
            ],
        )
    }

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

export class SendPacketTransferFactory implements EntityFactory {
    create(): SendPacketTransfer {
        return new SendPacketTransfer();
    }
}