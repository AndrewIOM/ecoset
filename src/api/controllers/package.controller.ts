import { Body, Controller, Get, Path, Post, Route } from 'tsoa';
import { JobState, EcosetJobRequest, JobStatusResponse, JobSubmitResponse } from '../types';
import { stateCache, redisStateCache } from '../state-cache';
import { queue } from '../queue';
import { listVariableDtos } from '../registry';
import * as cache from '../output-cache';
import uuidv4 from 'uuid/v4';

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
			let r = await queue.add(jobRequest, { jobId: uuidv4() });
			return { success: true, jobId: r.id.toString(), message: "" };
		}

		@Get('list')
		public async list() {
			return listVariableDtos();
		}

		@Get('fetch/{packageId}')
		public async fetch(@Path('packageId') packageId: string) {
			const pkg = await queue.getJob(packageId);
			if (pkg) {
				if (pkg.isCompleted()) {
					const stream = cache.getCachedResult(packageId.toString());
					if (!stream) return undefined;
					return stream;
				}
			}
		}

}
