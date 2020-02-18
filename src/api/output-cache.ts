import config from 'config';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const cacheRootDir = config.get<string>("locations.cache");

const deleteFolderRecursive = (p: string) => {
    if (fs.existsSync(p)) {
        fs.readdirSync(p).forEach((file, index) => {
            const curPath = path.join(p, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(p);
    }
};

// Set up a cache directory
export function tryEstablishCache(jobId: string) {
    if (!fs.existsSync(cacheRootDir)) {
        logger.error("Cache root was not accessible: " + cacheRootDir);
        return null;
    }

    const jobCacheDir = path.format({ dir: cacheRootDir + "/" + jobId });
    if (fs.existsSync(jobCacheDir)) {
        logger.warn("Output folder already exists, removing for reprocessing: " + jobId);
        deleteFolderRecursive(jobCacheDir);
    }
    fs.mkdirSync(jobCacheDir);
    logger.info("Created file cache for job: " + jobId);
    return jobCacheDir;
}

export function getCachedResult(jobId: string) {
    const cachedResult = path.format({ dir: cacheRootDir + "/" + jobId, base: "output.json" });
    if (fs.existsSync(cachedResult)) {
        return fs.createReadStream(cachedResult);
    }
}
