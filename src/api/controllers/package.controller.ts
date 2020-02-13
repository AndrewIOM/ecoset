import { Body, Controller, Get, Header, Path, Post, Query, Route, SuccessResponse } from 'tsoa';
import { JobState, EcosetJobRequest } from '../types';
import { redisStateCache } from '../state-cache';
import { queue } from '../queue';
import { listVariableDtos } from '../registry';
import * as cache from '../output-cache';

const stateCache = redisStateCache.create();

@Route('Data')
export class DataPackageController extends Controller {
		
		@Get('status/{packageId}')
		public async status(@Path('packageId') packageId: number): Promise<JobState> {
			return await redisStateCache.getState(stateCache, packageId);
		}

		@Post('submit')
		public async submit(@Body() jobRequest: EcosetJobRequest) {
			let r = await queue.add(jobRequest);
			
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
					console.log(stream);
					return stream.read();
				}
			}
		}

}
