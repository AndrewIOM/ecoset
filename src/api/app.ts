import express = require('express');
import Bull = require('bull');
import BullBoard = require("bull-board");
import UUID = require("uuid");
import Winston = require("winston");
import bodyParser = require('body-parser');
import config from 'config';

import { EcosetJobRequest, JobState } from './types';
import { processJob } from './job-processor';
import { redisStateCache } from './state-cache';
import { listVariables } from './registry';

////////////////////
/// Web App
////////////////////

const app: express.Application = express();

const queue = new Bull<EcosetJobRequest>('ecoset', {
    limiter: {
        max: 9999,             // 3 jobs at a time
        duration: 43200000  // 12 hour maximum limit
    }
});

const stateCache = redisStateCache.create();

queue.process(async (job:Bull.Job<EcosetJobRequest>) => {
    console.log("Running job");
    return processJob(job.data, job.id);
});

app.use(bodyParser.json());

app.post("/submit", async (request, response) => {
    // TODO proper parsing
    let job : EcosetJobRequest = request.body;
    console.log(job);
    let r = await queue.add(job);
    response.send(r.id);
});

app.get("/list", (request, response) => {
    response.json(listVariables());
});

app.post("/poll", (request, response) => {
    const jobId = 2;//request.body as number;
    console.log("Job ID is " + jobId);
    redisStateCache.getState(stateCache,jobId)
        .catch(e => console.log(e))
        .then(s => {
            console.log("State is " + s);
            response.json(s) });
});

app.post("/fetch", (request, response) => {

});

app.listen(config.get("api.port"), function () {
    Winston.info('Example app listening on port ' + config.get("api.port"));
});

BullBoard.setQueues(queue);
app.use('/admin/queues', BullBoard.UI);
