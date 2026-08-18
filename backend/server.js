import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: '*', // Allow requests from Next.js frontend
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api', chatRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Cyber AI Agent Backend',
    version: '2.0.0',
    description: 'Node.js Express + Groq API + MongoDB OWASP RAG Cybersecurity Assistant',
    endpoints: {
      health: '/api/health',
      chat: 'POST /api/chat',
      messages: 'GET /api/messages',
      feedback: 'POST /api/feedback',
      scan: 'POST /api/scan (Katana, GoSpider, Hakrawler, Arjun, Dalfox)',
      clear: 'DELETE /api/messages'
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
