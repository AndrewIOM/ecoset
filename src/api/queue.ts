import { Worker, Queue, ConnectionOptions } from 'bullmq';
import fs from 'fs';
import { EcosetJobRequest } from "./types";
import config from 'config';

const connection : ConnectionOptions = {
    port: config.get('cache.port'),
    host: config.get('cache.host')
}

export const queue = new Queue<EcosetJobRequest>('ecoset', {
    connection: connection
});

const processorFile = __dirname + '/workers/job-processor.js';

const worker = new Worker('ecoset', processorFile, {
    limiter: {
        max: 50,
        duration: 43200000
    },
    connection: connection
});