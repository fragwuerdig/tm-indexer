import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { Message } from "../worker/TxProcessor"

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

export class AnyValueFilter extends Filter {
    constructor(event_name: string, attribute_key: string) {
        super(event_name, attribute_key, "");
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

export class ValueHasJsonFieldsFilter extends Filter {
    json_fields: string[];

    constructor(event_name: string, attribute_key: string, json_fields: string[]) {
        super(event_name, attribute_key, "");
        this.json_fields = json_fields;
    }

    filter(msg: Message): boolean {
        const event = msg.events.find((e) => e.type === this.event_name);
        if (event) {
            const attribute = event.attributes.find((a) => a.key === this.attribute_key);
            if (attribute) {
                const jsonData = JSON.parse(attribute.value);
                return this.json_fields.every((field) => field in jsonData);
            }
        }
        return false;
    }
}

export class HasEventFilter extends Filter {
    constructor(event_name: string) {
        super(event_name, "", "");
    }

    filter(msg: Message): boolean {
        const event = msg.events.find((e) => e.type === this.event_name);
        return event !== undefined;
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

// this assigner assumes that the attribute value is a one-level JSON string
export class JsonAssigner extends Assigner {

    field_names: string[];

    constructor(event_name: string, attribute_key: string, field_names: string[]) {
        super(event_name, attribute_key, "");
        this.field_names = field_names;
    }

    assignValue(msg: Message, input: any): any {
        const event = msg.events.find((e) => e.type === this.event_name);
        if (event) {
            const attribute = event.attributes.find((a) => a.key === this.attribute_key);
            if (attribute) {
                const jsonData = JSON.parse(attribute.value);
                this.field_names.forEach((field_name) => {
                    if (jsonData[field_name] !== undefined) {
                        input[field_name] = jsonData[field_name];
                    }
                })
            }
        }
    }
    
}

export interface EntityI {
    msg_type: string | undefined;
    filters: Filter[];
    assigners: Assigner[];
}

@Entity()
export class EntityBase implements EntityI {
    
    msg_type: string | undefined;
    filters: Filter[];
    assigners: Assigner[];

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    tx!: string;

    @Column()
    time!: Date;

    // processing by 2nd level indexer
    @Column()
    processed: boolean = false;

    @Column()
    chain_id!: string;

    constructor(msg_type: string | undefined, filters: Filter[], assigners: Assigner[]) {
        this.msg_type = msg_type;
        this.filters = filters;
        this.assigners = assigners;
    }
    
    assignValues(msg: Message): any {
        this.tx = msg.tx || '';
        this.time = msg.time || new Date();
        this.chain_id = msg.chain_id || '';
        this.assigners.forEach((assigner) => {
            assigner.assignValue(msg, this);
        });
    }
}

export interface EntityFactory {
    create(): EntityBase;
}
