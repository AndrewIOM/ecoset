import bullBoard = require("bull-board");
import bodyParser = require('body-parser');
import config from 'config';
import express = require('express');
import swaggerUi from 'swagger-ui-express';
import { logger } from './logger';

import { RegisterRoutes } from './routes/routes';
import { queue } from './queue';
const x = require('./dist/swagger.json');

////////////////////
/// Web App
////////////////////

const app = express();

app.use(bodyParser.json());

RegisterRoutes(app);

bullBoard.setQueues(queue);
app.use('/admin/queues', bullBoard.UI);
app.use('/', swaggerUi.serve, swaggerUi.setup(x));

app.listen(config.get("api.port"), () => {
    logger.info('Example app listening on port ' + config.get("api.port"));
});