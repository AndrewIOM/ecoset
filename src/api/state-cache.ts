import config from 'config';
import * as redis from 'redis';
import { JobState } from './types';
import { logger } from './logger';

const REDIS_PREFIX = 'state';

function redisKey(key: string) {
  return `${REDIS_PREFIX}:${key}`;
}

function create() {
    const redisHost = config.get<string>("cache.host");
    const redisPort = config.get<number>("cache.port");
    const client = redis.createClient({
        socket: {
            port: redisPort,
            host: redisHost },
    });

    (async () => {
        await client.connect();
    })();

    client.on("error", err => { 
        logger.error("Redis error states: " + err) 
        throw new Error("Redis says " + err);
    });

    return client;
}

async function setJobState(cache:redis.RedisClientType<any,any,any>, jobId:string, state:JobState) {
    console.log("Setting job state");
    const result = await cache.set(redisKey(jobId), state.toString());
    if (result == null) return false;
    return true;
}

async function getJobState(cache:redis.RedisClientType<any,any,any>, jobId:string) : Promise<JobState> { 
    console.log("Getting job state");
    if (!cache.exists(jobId)) {
        return JobState.NonExistent;
    }
    let r = await cache.get(redisKey(jobId));
    if (r != null) {
        const tryState: JobState | undefined = (<any>JobState)[r];
        if (tryState !== undefined) return tryState;    
    }
    return JobState.NonExistent;
}

export interface StateCache {
    create(): redis.RedisClientType<any,any,any>;
    setState(cache:redis.RedisClientType<any,any,any>, jobId:string, state:JobState): Promise<boolean>;
    getState(cache:redis.RedisClientType<any,any,any>, jobId:string) : Promise<JobState>;
}

export const redisStateCache : StateCache = {
    create: create,
    getState: getJobState,
    setState: setJobState
};

export const stateCache = create();