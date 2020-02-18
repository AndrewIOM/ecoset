import bull from 'bull';
import { EcosetJobRequest } from "./types";

export const queue = new bull<EcosetJobRequest>('ecoset', {
    limiter: {
        max: 9999,             // 3 jobs at a time
        duration: 43200000  // 12 hour maximum limit
    }
});

queue.process(__dirname + '/job-processor.ts');