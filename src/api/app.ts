import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import bodyParser = require('body-parser');
import config from 'config';
import express from 'express';
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

app.use('/admin/queues', serverAdapter.getRouter());
app.use('/', swaggerUi.serve as any, swaggerUi.setup(x) as any);

app.listen(config.get("api.port"), () => {
    logger.info('Ecoset listening on port ' + config.get("api.port"));
});