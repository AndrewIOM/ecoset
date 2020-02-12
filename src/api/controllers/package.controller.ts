import { Body, Controller, Get, Header, Path, Post, Query, Route, SuccessResponse } from 'tsoa';
import { JobState, EcosetJobRequest } from '../types';
import { redisStateCache } from '../state-cache';
import { queue } from '../queue';
import { listVariableDtos } from '../registry';

const stateCache = redisStateCache.create();

@Route('Data')
export class DataPackageController extends Controller {
		
		@Get('status/{analysisId}')
		public async status(@Path('analysisId') analysisId: number): Promise<JobState> {
			return await redisStateCache.getState(stateCache, analysisId);
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

}


// app.post("/submit", async (request, response) => {
//   // TODO proper parsing
//   let job : EcosetJobRequest = request.body;
//   console.log(job);
//   let r = await queue.add(job);
//   response.send(r.id);
// });

// app.get("/list", (request, response) => {
//   response.json(listVariables());
// });

// app.post("/fetch", (request, response) => {

// });
