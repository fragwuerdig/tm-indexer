import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { Assigner, EntityBase, EntityFactory, EntityI, Filter } from "./EntityI";

@Entity()
export class RecvRedeemPacket extends EntityBase {

    constructor() {
        super(
            "/ibc.core.channel.v1.MsgRecvPacket",
            [
                new Filter("write_acknowledgement", "packet_ack", '{"result":"AQ=="}'),
                new Filter("redeem_token_packet", "module", "redeem"),
            ],
            [
                new Assigner("redeem_token_packet", "denom", "denom"),
                new Assigner("redeem_token_packet", "amount", "amount"),
                new Assigner("redeem_token_packet", "receiver", "to"),
                new Assigner("recv_packet", "packet_sequence", "seq"),
                new Assigner("recv_packet", "packet_src_channel", "src_channel"),
                new Assigner("recv_packet", "packet_src_port", "src_port"),
                new Assigner("recv_packet", "packet_dst_channel", "dst_channel"),
                new Assigner("recv_packet", "packet_dst_port", "dst_port"),
            ],
        )
    }

    @Column()
    denom!: string;

    @Column()
    amount!: string;

    @Column()
    to!: string;

    @Column()
    seq!: string;

    @Column()
    src_channel!: string;

    @Column()
    src_port!: string;

    @Column()
    dst_channel!: string;

    @Column()
    dst_port!: string;

}

export class RecvRedeemPacketFactory implements EntityFactory {
    create(): RecvRedeemPacket {
        return new RecvRedeemPacket();
    }
}