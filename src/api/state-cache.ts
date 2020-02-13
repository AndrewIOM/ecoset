import config from 'config';
import redis from 'redis';
import { JobState } from './types'
import { logger } from './logger';;
import {promisify} from 'util';

const getAsync = (client:redis.RedisClient) => {
    return promisify(client.get).bind(client);
}

const setAsync = (client:redis.RedisClient) => {
    return promisify(client.set).bind(client);
}

function create() {
    const redisHost = config.get<string>("cache.host");
    const redisPort = config.get<number>("cache.port");
    const client = redis.createClient(redisPort, redisHost, {
        prefix: "state:"
    });
    client.on("error", err => { 
        logger.error("Redis error states: " + err) 
    });
    return client;
}

function setJobState(cache:redis.RedisClient, jobId:number, state:JobState) {
    return cache.set(jobId.toString(), state.toString());
}

async function getJobState(cache:redis.RedisClient, jobId:number) : Promise<JobState> { 
    if (!cache.exists(jobId.toString())) {
        return JobState.NonExistent;
    }
    let r = await getAsync(cache)(jobId.toString());
    const tryState: JobState | undefined = (<any>JobState)[r];
    if (tryState !== undefined) return tryState;
    return JobState.NonExistent;
}

export interface StateCache {
    create(): redis.RedisClient;
    setState(cache:redis.RedisClient, jobId:number, state:JobState): boolean;
    getState(cache:redis.RedisClient, jobId:number) : Promise<JobState>;
}

export const redisStateCache : StateCache = {
    create: create,
    getState: getJobState,
    setState: setJobState
};

export const stateCache = create();