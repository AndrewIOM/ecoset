import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import bodyParser = require('body-parser');
import config from 'config';
import express, {
  Response as ExResponse,
  Request as ExRequest,
  NextFunction,
} from "express";
import { ValidateError } from "tsoa";
import swaggerUi from 'swagger-ui-express';
import { logger } from './logger';
import { RegisterRoutes } from './routes/routes';
import { queue } from './queue';

const x = require('./dist/swagger.json');

////////////////////
/// Web App
////////////////////

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter: serverAdapter,
  });

const app = express();

app.use(bodyParser.json());

RegisterRoutes(app);

app.use(function errorHandler(
  err: unknown,
  req: ExRequest,
  res: ExResponse,
  next: NextFunction
): ExResponse | void {
  if (err instanceof ValidateError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
    return res.status(422).json({
      message: "Validation Failed",
      details: err?.fields,
    });
  }
  if (err instanceof Error) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }

  next();
});

app.use('/admin/queues', serverAdapter.getRouter());
app.use('/', swaggerUi.serve as any, swaggerUi.setup(x) as any);

app.listen(config.get("api.port"), () => {
    logger.info('Ecoset listening on port ' + config.get("api.port"));
});