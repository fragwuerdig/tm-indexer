import express, { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { In, Between, MoreThanOrEqual, LessThanOrEqual } from "typeorm";
import { IbcRelayTxsView } from './entities/IbcRelayTxsView';
import { IbcFullTransferFlowView } from './entities/IbcFullTransferFlowView';
import { IbcRelayedTxsDailyBinnedView } from './entities/IbcRelayedTxsDailyBinnedView';
import { subDays, formatISO } from "date-fns";

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3000;

console.log(port);
type TransferResultType = 'timedout' | 'acknowledged';

app.use(express.json());

export const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'tm_indexer',
    entities: [
        IbcFullTransferFlowView,
        IbcRelayTxsView,
        IbcRelayedTxsDailyBinnedView
    ],
    synchronize: false,
    logging: false,
});

dataSource.initialize()
    .then(() => {
        console.log('Data Source has been initialized!');
    })
    .catch((err) => {
        console.error('Error during Data Source initialization', err);
        process.exit(1);
    });

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

app.get('/api/v1/transfers', async (req: Request, res: Response) => {
    
    dataSource.isInitialized || await dataSource.initialize();
    
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = parseInt(req.query.limit as string) || 20;
    const result = req.query.result as string | undefined;
    const relayer = req.query.relayer as string | undefined;
    const timestampStart = parseInt(req.query.timestampStart as string) || undefined;
    const timestampEnd = parseInt(req.query.timestampEnd as string) || undefined;
    const fromChain = req.query.fromChain as string | undefined;
    const toChain = req.query.toChain as string | undefined;
    
    try {
        const where: any = {};
        if (result) { where.result_type = result as TransferResultType; }
        if (relayer) { where.relayer = relayer; }
        if (timestampStart && timestampEnd) {
            where.initiated = Between(new Date(timestampStart * 1000), new Date(timestampEnd * 1000));
        } else if (timestampStart) {
            where.initiated = MoreThanOrEqual(new Date(timestampStart * 1000));
        } else if (timestampEnd) {
            where.initiated = LessThanOrEqual(new Date(timestampEnd * 1000));
        }
        if (fromChain) { where.from_chain = fromChain; }
        if (toChain) { where.to_chain = toChain; }

        const transfers = await dataSource.getRepository(IbcFullTransferFlowView).find({
            where,
            skip: page * limit,
            take: limit,
            order: { initiated: 'DESC' },
        });
        
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch transfers: ${error}` });
    }

});

app.get('/api/v1/relay_txs', async (req: Request, res: Response) => {

    dataSource.isInitialized || await dataSource.initialize();

    var relayer = req.query.relayers as string | undefined;
    if (relayer === "all") relayer = undefined;
    const chain = req.query.chain as string | undefined;
    
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = parseInt(req.query.limit as string) || 20;

    const timestampStart = parseInt(req.query.timestampStart as string) || undefined;
    const timestampEnd = parseInt(req.query.timestampEnd as string) || undefined;

    try {
        const where: any = {};
        
        if (relayer) {
            const relayers = relayer.split(",").map(r => r.trim()).filter(Boolean);
            console.log("Filtering by relayers:", relayers);
            if (relayers.length > 0) {
                where.relayer = In(relayers);
            }
        }

        if (chain) {
            where.chain_id = chain;
        }

        if (timestampStart && timestampEnd) {
            where.time = Between(new Date(timestampStart * 1000), new Date(timestampEnd * 1000));
        } else if (timestampStart) {
            where.time = MoreThanOrEqual(new Date(timestampStart * 1000));
        } else if (timestampEnd) {
            where.time = LessThanOrEqual(new Date(timestampEnd * 1000));
        }

        const transfers = await dataSource.getRepository(IbcRelayTxsView).find({
            where,
            skip: page * limit,
            take: limit,
            order: { time: 'DESC' },
        });
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch relay txs: ${error}` });
    }

});

app.get('/api/v1/binned_txs', async (req: Request, res: Response) => {
  dataSource.isInitialized || await dataSource.initialize();

  let relayer = req.query.relayers as string | undefined;
  if (relayer === "all") relayer = undefined;

  try {
    const qb = dataSource
      .getRepository(IbcRelayedTxsDailyBinnedView)
      .createQueryBuilder("v")
      .select("v.day", "day")
      .addSelect("SUM(v.tx_count)", "tx_count")
      .groupBy("v.day")
      .orderBy("v.day", "DESC");

    if (relayer) {
      const relayers = relayer.split(",").map(r => r.trim()).filter(Boolean);
      if (relayers.length > 0) qb.where("v.relayer IN (:...relayers)", { relayers });
    }

    const raw = await qb.getRawMany();

    const map = new Map(raw.map((r: any) => [r.day.toISOString().slice(0, 10), Number(r.tx_count)]));

    const result: { day: string; tx_count: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const day = formatISO(subDays(new Date(), i), { representation: "date" });
      result.push({ day, tx_count: map.get(day) ?? 0 });
    }

    res.json(result.reverse());
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch binned txs: ${error}` });
  }
});

app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
});

app.get('/api/v1/amount_txs', async (req: Request, res: Response) => {

    dataSource.isInitialized || await dataSource.initialize();

    let relayer = req.query.relayers as string | undefined;
    if (relayer === "all") relayer = undefined;

    let types = req.query.type as string | undefined;
    if (types === "all") types = undefined;

    try {
        const where: any = {};
        
        if (relayer) {
            const relayers = relayer.split(",").map(r => r.trim()).filter(Boolean);
            console.log("Filtering by relayers:", relayers);
            if (relayers.length > 0) {
                where.relayer = In(relayers);
            }
        }
        
        if (types) {
            const typesArray = types.split(",").filter((type) => type === 'timeout' || type === 'receive' || type === 'acknowledge') as ('timeout' | 'receive' | 'acknowledge')[];
            if (typesArray.length > 0) {
                where.type = In(typesArray);
            }
        }
        
        const txs = await dataSource
            .getRepository(IbcRelayTxsView)
            .createQueryBuilder("tx")
            .select("tx.tx_type", "type")
            .addSelect("COUNT(*)", "count")
            .where(where)
            .groupBy("tx.tx_type")
            .getRawMany();
        
        res.json(txs);

    } catch (error) {
        res.status(500).json({ error: `Failed to fetch amount txs: ${error}` });
    }

});