import { ViewEntity, ViewColumn } from "typeorm";

@ViewEntity({
    name: "ibc_full_transfer_flow",
    expression: `
    SELECT
      'timedout' AS result_type,
      send_packet_transfer.tx AS from_tx,
      NULL AS to_tx,
      timeout_packet.tx AS result_tx,
      send_packet_transfer.chain_id AS from_chain,
      channel_pair.from_chain_id AS to_chain,
      send_packet_transfer.sequence AS seq,
      send_packet_transfer.time AS initiated,
      timeout_packet.time AS completed,
      timeout_packet.relayer AS relayer_timeout,
      NULL AS relayer_receive,
      NULL AS relayer_acknowledge,
      send_packet_transfer.amount AS amount,
      send_packet_transfer.denom AS denom,
      send_packet_transfer.src_channel AS src_channel,
      send_packet_transfer.dest_channel AS dest_channel
    FROM send_packet_transfer
    INNER JOIN timeout_packet
      ON send_packet_transfer.src_channel = timeout_packet.src_channel
      AND send_packet_transfer.dest_channel = timeout_packet.dest_channel
      AND send_packet_transfer.sequence = timeout_packet.sequence
    INNER JOIN channel_pair
      ON send_packet_transfer.src_channel = channel_pair.dest_channel
      AND send_packet_transfer.dest_channel = channel_pair.src_channel

    UNION ALL

    SELECT
      'acknowledged' AS result_type,
      send_packet_transfer.tx AS from_tx,
      recv_packet_transfer.tx AS to_tx,
      acknowledge_packet.tx AS result_tx,
      send_packet_transfer.chain_id AS from_chain,
      channel_pair.from_chain_id AS to_chain,
      send_packet_transfer.sequence AS seq,
      send_packet_transfer.time AS initiated,
      acknowledge_packet.time AS completed,
      NULL AS relayer_timeout,
      recv_packet_transfer.relayer AS relayer_receive,
      acknowledge_packet.relayer AS relayer_acknowledge,
      send_packet_transfer.amount AS amount,
      send_packet_transfer.denom AS denom,
      send_packet_transfer.src_channel AS src_channel,
      send_packet_transfer.dest_channel AS dest_channel
    FROM send_packet_transfer
    INNER JOIN recv_packet_transfer
      ON send_packet_transfer.src_channel = recv_packet_transfer.src_channel
      AND send_packet_transfer.dest_channel = recv_packet_transfer.dest_channel
      AND send_packet_transfer.sequence = recv_packet_transfer.sequence
    INNER JOIN channel_pair
      ON send_packet_transfer.src_channel = channel_pair.dest_channel
      AND send_packet_transfer.dest_channel = channel_pair.src_channel
    INNER JOIN acknowledge_packet
      ON send_packet_transfer.src_channel = acknowledge_packet.src_channel
      AND send_packet_transfer.dest_channel = acknowledge_packet.dest_channel
      AND send_packet_transfer.sequence = acknowledge_packet.sequence
  `,
})

export class IbcFullTransferFlowView {

    @ViewColumn()
    result_type!: 'timedout' | 'acknowledged';

    @ViewColumn()
    from_tx!: string;

    @ViewColumn()
    to_tx!: string | null;

    @ViewColumn()
    result_tx!: string | null;

    @ViewColumn()
    from_chain!: string;

    @ViewColumn()
    to_chain!: string;

    @ViewColumn()
    seq!: string;

    @ViewColumn()
    initiated!: Date;

    @ViewColumn()
    completed!: Date;

    @ViewColumn()
    relayer_receive!: string | null;

    @ViewColumn()
    relayer_timeout!: string | null;

    @ViewColumn()
    relayer_acknowledge!: string | null;

    @ViewColumn()
    amount!: string | null;

    @ViewColumn()
    denom!: string | null;

    @ViewColumn()
    src_channel!: string | null;
    
    @ViewColumn()
    dest_channel!: string | null;

}
