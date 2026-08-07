import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';
import crawlerRoutes from './routes/crawler.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow requests from Next.js frontend
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api', chatRoutes);
app.use('/api/crawler', crawlerRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Cyber AI Agent Backend',
    version: '1.0.0',
    description: 'Node.js Express + Groq API + MongoDB backend server with Web Security Crawler',
    endpoints: {
      health: '/api/health',
      chat: 'POST /api/chat',
      messages: 'GET /api/messages',
      clear: 'DELETE /api/messages',
      startCrawl: 'POST /api/crawler/start',
      crawlResults: 'GET /api/crawler/results/:scanId'
    }
  });
});

// Initialize DB and launch server
const startServer = async () => {
  console.log('[Server] Starting Cyber AI Agent backend...');
  await connectDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Express API server listening on http://127.0.0.1:${PORT}`);
    console.log(`[Server] Health Check available at http://127.0.0.1:${PORT}/api/health`);
  });
};

startServer().catch(err => {
  console.error('[Server] Fatal startup error:', err);
});
