import config from 'config';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const cacheRootDir = config.get<string>("locations.cache");

// Set up a cache directory
export function tryEstablishCache(jobId:string) {    
    if (!fs.existsSync(cacheRootDir)) {
        logger.error("Cache root was not accessible: " + cacheRootDir);
        return null;
    }

    const jobCacheDir = path.format({ dir: cacheRootDir + "/" + jobId });
    if (fs.existsSync(jobCacheDir)) {
        logger.warn("Output folder already exists, removing for reprocessing: " + jobId);
        fs.rmdirSync(jobCacheDir);
    }
    fs.mkdirSync(jobCacheDir);
    logger.info("Created file cache for job: " + jobId);
    return jobCacheDir;
}
