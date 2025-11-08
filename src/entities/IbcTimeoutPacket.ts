import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { AnyValueFilter, Assigner, EntityBase, EntityFactory, EntityI, HasEventFilter, JsonAssigner, ValueHasJsonFieldsFilter } from "./EntityI";

@Entity()
export class TimeoutPacket extends EntityBase {

    constructor() {
        super(
            undefined,
            [
                new HasEventFilter("timeout_packet"),
            ],
            [
                new Assigner("message", "sender", "relayer"),
                new Assigner("timeout_packet", "packet_src_port", "src_port"),
                new Assigner("timeout_packet", "packet_src_channel", "src_channel"),
                new Assigner("timeout_packet", "packet_dst_port", "dest_port"),
                new Assigner("timeout_packet", "packet_dst_channel", "dest_channel"),
                new Assigner("timeout_packet", "packet_sequence", "sequence"),
            ],
        )
    }

    @Column()
    relayer!: string;

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

export class TimeoutPacketFactory implements EntityFactory {
    create(): TimeoutPacket {
        return new TimeoutPacket();
    }
}