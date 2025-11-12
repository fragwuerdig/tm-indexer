import { ViewEntity, ViewColumn } from "typeorm";

@ViewEntity({
  name: "ibc_relayed_txs_daily_binned",
  expression: `
    SELECT
      relayer,
      DATE(time) AS day,
      COUNT(*) AS tx_count
    FROM (
      SELECT relayer, time FROM timeout_packet
      UNION ALL
      SELECT relayer, time FROM recv_packet_transfer
      UNION ALL
      SELECT relayer, time FROM acknowledge_packet
    ) AS all_txs
    GROUP BY relayer, DATE(time)
    ORDER BY relayer, day
  `,
})

export class IbcRelayedTxsDailyBinnedView {
  @ViewColumn()
  relayer!: string;

  @ViewColumn()
  day!: Date;

  @ViewColumn()
  tx_count!: number;

}
