import express from 'express';
import { startCrawl, getScanResults, inspectEndpointDOMController, semgrepScanController, semgrepStatusController } from '../controllers/crawler.controller.js';

const router = express.Router();

// POST /api/crawler/start - Start web security crawl
router.post('/start', startCrawl);

// GET /api/crawler/results/:scanId - Get scan results
router.get('/results/:scanId', getScanResults);

// POST /api/crawler/inspect-dom - Step 2: Visit endpoint and extract Playwright networkidle DOM HTML
router.post('/inspect-dom', inspectEndpointDOMController);

// POST /api/crawler/semgrep-scan - Step 3: Run Semgrep XSS analysis on extracted source code
router.post('/semgrep-scan', semgrepScanController);

// GET /api/crawler/semgrep-status - Check if Semgrep CLI is installed
router.get('/semgrep-status', semgrepStatusController);

export default router;
