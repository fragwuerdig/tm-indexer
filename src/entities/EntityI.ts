import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { Message } from "../TxProcessor"

type FilterObj = Filter | FilterAttrExists;

export class Filter {
    event_name: string;
    attribute_key: string;
    attribute_value: string;

    constructor(event_name: string, attribute_key: string, attribute_value: string) {
        this.event_name = event_name;
        this.attribute_key = attribute_key;
        this.attribute_value = attribute_value;
    }

    filter(msg: Message): boolean {
        const event = msg.events.find((e) => e.type === this.event_name);
        if (event) {
            const attribute = event.attributes.find((a) => a.key === this.attribute_key);
            if (attribute) {
                if (attribute.value === this.attribute_value) {
                    return true;
                }
            }
        }
        return false;
    }
}

export class FilterAttrExists {
    event_name: string;
    attribute_key: string;
    
    constructor(event_name: string, attribute_key: string) {
        this.event_name = event_name;
        this.attribute_key = attribute_key;
    }
    
    filter(msg: Message): boolean {
        const event = msg.events.find((e) => e.type === this.event_name);
        if (event) {
            const attribute = event.attributes.find((a) => a.key === this.attribute_key);
            if (attribute) {
                return true;
            }
        }
        return false;
    }
}

export class Assigner {
    event_name: string;
    attribute_key: string;
    field_name: string;

    constructor(event_name: string, attribute_key: string, field_name: string) {
        this.event_name = event_name;
        this.attribute_key = attribute_key;
        this.field_name = field_name;
    }

    assignValue(msg: Message, input: any): any {
        const event = msg.events.find((e) => e.type === this.event_name);
        if (event) {
            const attribute = event.attributes.find((a) => a.key === this.attribute_key);
            if (attribute) {
                input[this.field_name] = attribute.value;
            }
        }
        return input;
    }

}

export interface EntityI {
    msg_type: string;
    filters: FilterObj[];
    assigners: Assigner[];
}

@Entity()
export class EntityBase implements EntityI {
    
    msg_type: string;
    filters: FilterObj[];
    assigners: Assigner[];

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    tx!: string;

    @Column()
    time!: Date;
    
    constructor(msg_type: string, filters: FilterObj[], assigners: Assigner[]) {
        this.msg_type = msg_type;
        this.filters = filters;
        this.assigners = assigners;
    }
    
    assignValues(msg: Message): any {
        this.tx = msg.tx || '';
        this.time = msg.time || new Date();
        this.assigners.forEach((assigner) => {
            assigner.assignValue(msg, this);
        });
    }
}

export interface EntityFactory {
    create(): EntityBase;
}
