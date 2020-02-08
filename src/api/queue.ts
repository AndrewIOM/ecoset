import bull from 'bull';
import { EcosetJobRequest } from "./types";
import { processJob } from './job-processor';

export const queue = new bull<EcosetJobRequest>('ecoset', {
    limiter: {
        max: 9999,             // 3 jobs at a time
        duration: 43200000  // 12 hour maximum limit
    }
});

queue.process(async (job:bull.Job<EcosetJobRequest>) => {
    console.log("Running job");
    const result = processJob(job.data, job.id);
    job.finished();
});
