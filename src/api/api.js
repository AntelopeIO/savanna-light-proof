import express from 'express';
import bodyParser from 'body-parser';

import proofs from './proofs.js'; 
import status from './status.js'; 

const router = express.Router();

router.use('/proofs', proofs);
router.use('/status', status);

export const setupRoutes = (app) => {
  app.use(bodyParser.json());
  app.use('/api', router);
};