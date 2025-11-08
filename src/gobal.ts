import { config } from 'dotenv';
import 'dotenv/config';

config();

//export const RPC_URL = 'https://tc-rpc.luncgoblins.com';
export const START_HEIGHTS = process.env.START_HEIGHTS ? process.env.START_HEIGHTS.split(',').map(Number) : [];
export const CHAIN_IDS = process.env.CHAIN_IDS ? process.env.CHAIN_IDS.split(',') : [];