import { Body, Controller, Get, Path, Post, Route } from 'tsoa';
import { JobState, EcosetJobRequest } from '../types';
import { stateCache, redisStateCache } from '../state-cache';
import { queue } from '../queue';
import { listVariableDtos } from '../registry';
import * as cache from '../output-cache';
import uuidv4 from 'uuid/v4';

@Route('Data')
export class DataPackageController extends Controller {
		
		@Get('status/{packageId}')
		public async status(@Path('packageId') packageId: number): Promise<JobState> {
			return await redisStateCache.getState(stateCache, packageId);
		}

		@Post('submit')
		public async submit(@Body() jobRequest: EcosetJobRequest) {
			let r = await queue.add(jobRequest, { jobId: uuidv4() });
			return r.id;
		}

		@Get('list')
		public async list() {
			return listVariableDtos();
		}

		@Get('fetch/{packageId}')
		public async fetch(@Path('packageId') packageId: number) {
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
