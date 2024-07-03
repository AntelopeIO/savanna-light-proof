import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'running', last_block: global.db.getLastBlock() });
});

export default router;