import { Body, Controller, Get, Path, Post, Route } from 'tsoa';
import { JobState, EcosetJobRequest, JobStatusResponse, JobSubmitResponse } from '../types';
import { stateCache, redisStateCache } from '../state-cache';
import { queue } from '../queue';
import { listVariableDtos } from '../registry';
import * as cache from '../output-cache';
import { v4 as uuid } from 'uuid';
import { logger } from '../logger';

@Route('Data')
export class DataPackageController extends Controller {
		
		@Get('status/{packageId}')
		public async status(@Path('packageId') packageId: string): Promise<JobStatusResponse> {
			return redisStateCache.getState(stateCache, packageId)
			.then(s => { return { success: true, message: "", jobState: s } })
			.catch(e => { return { success: false, message: "Could not get job status", jobState: JobState.NonExistent } });
		}

		@Post('submit')
		public async submit(@Body() jobRequest: EcosetJobRequest): Promise<JobSubmitResponse> {
			const newId = uuid();
			let r = await queue.add(newId, jobRequest, { jobId: newId });
			let stateSet = await redisStateCache.setState(stateCache, newId, JobState.Queued);
			if (!stateSet) {
				logger.error("Queued state could not be set for job in redis cache");
			}
			return { success: true, jobId: newId, message: "Analysis successfully submitted" };
		}

		@Get('list')
		public async list() {
			return listVariableDtos();
		}

		@Get('fetch/{packageId}')
		public async fetch(@Path('packageId') packageId: string) {
			const pkg = await queue.getJob(packageId);
			if (pkg) {
				if (await pkg.isCompleted()) {
					const stream = cache.getCachedResult(packageId.toString());
					if (!stream) return undefined;
					return stream;
				}
			}
		}

}
