import express, { Request, Response } from 'express';
import { IbcFullTransferFlowView } from './entities/IbcFullTransferFlowView';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
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
    entities: [IbcFullTransferFlowView],
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
    const timeframe = parseInt(req.query.timeframe as string) || undefined;
    
    try {
        const where: any = {};
        if (result) { where.result_type = result as TransferResultType; }
        if (relayer) { where.relayer = relayer; }
        if (timeframe) { where.initiated = { $gte: new Date(Date.now() - timeframe * 1000) }; }

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

app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
});
