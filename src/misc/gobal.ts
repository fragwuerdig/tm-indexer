import { config } from 'dotenv';
import 'dotenv/config';

config();

//export const RPC_URL = 'https://tc-rpc.luncgoblins.com';
export const CHAIN_IDS = process.env.CHAIN_IDS ? process.env.CHAIN_IDS.split(',') : [];