import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { Assigner, EntityBase, EntityFactory, EntityI } from "./EntityI";

@Entity()
export class BankTransfer extends EntityBase {

    constructor() {
        super(
            "/cosmos.bank.v1beta1.MsgSend",
            [],
            [
                new Assigner("transfer", "sender", "from"),
                new Assigner("transfer", "recipient", "to"),
                new Assigner("transfer", "amount", "amount"),
            ],
        )
    }

    @Column()
    amount!: string;

    @Column()
    from!: string;

    @Column()
    to!: string;

}

export class BankTransferFactory implements EntityFactory {
    create(): BankTransfer {
        return new BankTransfer();
    }
}