import { ViewEntity, ViewColumn } from "typeorm";

@ViewEntity({
    name: "ibc_relay_txs",
    expression: `
    SELECT
      'timeout' AS tx_type,
      relayer,
      src_port, 
      src_channel,
      dest_port,
      dest_channel,
      sequence,
      time,
      tx,
      chain_id
    FROM timeout_packet AS tp

    UNION ALL

    SELECT
      'receive' AS tx_type,
      relayer,
      src_port, 
      src_channel,
      dest_port,
      dest_channel,
      sequence,
      time,
      tx,
      chain_id
    FROM recv_packet_transfer AS rp

    UNION ALL

    SELECT
      'acknowledge' AS tx_type,
      relayer,
      src_port, 
      src_channel,
      dest_port,
      dest_channel,
      sequence,
      time,
      tx,
      chain_id
    FROM acknowledge_packet AS ap
    `,
})

export class IbcRelayTxsView {

    @ViewColumn()
    tx_type!: 'timeout' | 'receive' | 'acknowledge';

    @ViewColumn()
    relayer!: string;

    @ViewColumn()
    src_port!: string;

    @ViewColumn()
    src_channel!: string;

    @ViewColumn()
    dest_port!: string;

    @ViewColumn()
    dest_channel!: string;

    @ViewColumn()
    sequence!: string;

    @ViewColumn()
    time!: Date;

    @ViewColumn()
    tx!: string;

    @ViewColumn()
    chain_id!: string;

}