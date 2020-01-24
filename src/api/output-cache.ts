import config from 'config';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

const cacheRootDir = config.get<string>("locations.cache");

// Set up a cache directory
export function tryEstablishCache(jobId:string) {    
    if (!fs.existsSync(cacheRootDir)) {
        winston.error("Cache root was not accessible: " + cacheRootDir);
        return null;
    }

    const jobCacheDir = path.format({ dir: cacheRootDir + "/" + jobId });
    if (fs.existsSync(jobCacheDir)) {
        winston.warn("Output folder already exists, removing for reprocessing: " + jobId);
        fs.rmdirSync(jobCacheDir);
    }
    fs.mkdirSync(jobCacheDir);
    winston.info("Created file cache for job: " + jobId);
    return jobCacheDir;
}
