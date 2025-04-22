import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { Assigner, EntityBase, EntityFactory, EntityI, Filter, FilterAttrExists } from "./EntityI";
import { Message } from "../TxProcessor";

@Entity()
export class EthereumTx extends EntityBase {

    constructor() {
        super(
            "/vsc.evm.v1.MsgEthereumTx",
            [
                // wrapped vsc txs are cosmos txs and have no
                // eth hash in the backend
                new FilterAttrExists("ethereum_tx", "ethereumTxHash"),
            ],
            [
                new Assigner("ethereum_tx", "ethereumTxHash", "eth_hash"),
                new Assigner("ethereum_tx", "amount", "amount"),
                new Assigner("ethereum_tx", "recipient", "to"),
                new Assigner("message", "sender", "from"),
            ],
        )
    }

    @Column()
    eth_hash!: string;

    // wrapped vsc txs have not an amount
    @Column({ nullable: true })
    amount!: string;

    // wrapped vsc txs have not a from
    @Column()
    from!: string;

    // wrapped vsc txs have not a to
    @Column({ nullable: true })
    to!: string;
}

export class EthereumTxFactory implements EntityFactory {
    create(): EthereumTx {
        return new EthereumTx();
    }
}