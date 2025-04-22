import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { Assigner, EntityBase, EntityFactory, EntityI, Filter } from "./EntityI";
import { Message } from "../TxProcessor";

@Entity()
export class EthereumTx extends EntityBase {

    constructor() {
        super(
            "/vsc.evm.v1.MsgEthereumTx",
            [],
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

    @Column()
    amount!: string;

    @Column()
    from!: string;

    @Column()
    to!: string;
}

export class EthereumTxFactory implements EntityFactory {
    create(): EthereumTx {
        return new EthereumTx();
    }
}