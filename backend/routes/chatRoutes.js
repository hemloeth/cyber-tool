import express from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { generateAIResponse, getGroqClient } from '../services/groqService.js';
import { loadOWASPKnowledge } from '../services/owaspSearchService.js';
import { addLearnedRule } from '../services/feedbackService.js';

const router = express.Router();
let inMemoryMessages = [];

const isDBConnected = () => mongoose.connection.readyState === 1;

// GET /api/health - Health & RAG status endpoint
router.get('/health', async (req, res) => {
  const dbStatus = isDBConnected() ? 'connected' : 'disconnected (using memory buffer)';
  const groqConfigured = getGroqClient() !== null;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const owaspChunksCount = loadOWASPKnowledge();

  res.json({
    status: 'online',
    backend: 'Node.js + Express',
    mongodb: dbStatus,
    groq: groqConfigured ? 'configured' : 'key_missing (demo mode)',
    activeModel: model,
    owaspKnowledgeBase: {
      status: owaspChunksCount > 0 ? 'indexed' : 'empty',
      chunksIndexed: owaspChunksCount
    },
    timestamp: new Date().toISOString()
  });
});

// GET /api/messages - Retrieve message history
router.get('/messages', async (req, res) => {
  const sessionId = req.query.sessionId || 'default_session';
  try {
    if (isDBConnected()) {
      const messages = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();
      return res.json({ success: true, source: 'mongodb', messages });
    } else {
      return res.json({ success: true, source: 'memory', messages: inMemoryMessages });
    }
  } catch (error) {
    console.error('[API] Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve message history.' });
  }
});

// POST /api/feedback - Save a new correction / rule to AI learning store
router.post('/feedback', async (req, res) => {
  const { rule, category } = req.body;
  if (!rule || typeof rule !== 'string' || rule.trim() === '') {
    return res.status(400).json({ success: false, error: 'Rule text is required.' });
  }

  try {
    const savedRule = addLearnedRule(rule.trim(), category || 'User Correction');
    return res.json({
      success: true,
      message: 'Learned rule successfully added to AI feedback store.',
      rule: savedRule
    });
  } catch (error) {
    console.error('[API] Error saving feedback rule:', error);
    res.status(500).json({ success: false, error: 'Failed to save feedback rule.' });
  }
});

// POST /api/chat - Process user prompt with OWASP RAG & return AI response
router.post('/chat', async (req, res) => {
  const { message, sessionId = 'default_session' } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'Message content is required.' });
  }

  const trimmedMessage = message.trim();

  try {
    // 1. Save User Message
    const userMsgObj = {
      sessionId,
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date()
    };

    if (isDBConnected()) {
      await Message.create(userMsgObj);
    } else {
      inMemoryMessages.push({ ...userMsgObj, _id: Date.now().toString() });
    }

    // 2. Fetch history for conversation context
    let history = [];
    if (isDBConnected()) {
      const dbHistory = await Message.find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      history = dbHistory.reverse();
    } else {
      history = inMemoryMessages.slice(-10);
    }

    // 3. RAG Retrieval + Groq AI Generation
    const aiResponse = await generateAIResponse(history);

    // 4. Save Assistant Response with OWASP Sources
    const assistantMsgObj = {
      sessionId,
      role: 'assistant',
      content: aiResponse.content,
      sources: aiResponse.sources || [],
      timestamp: new Date()
    };

    if (isDBConnected()) {
      await Message.create(assistantMsgObj);
    } else {
      inMemoryMessages.push({ ...assistantMsgObj, _id: (Date.now() + 1).toString() });
    }

    return res.json({
      success: true,
      message: assistantMsgObj,
      meta: {
        model: aiResponse.model,
        isDemo: aiResponse.isDemo,
        sourcesCount: (aiResponse.sources || []).length,
        dbSaved: isDBConnected()
      }
    });

  } catch (error) {
    console.error('[API] Error processing chat:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while generating the AI response.'
    });
  }
});

// DELETE /api/messages - Clear chat history
router.delete('/messages', async (req, res) => {
  const sessionId = req.query.sessionId || 'default_session';
  try {
    if (isDBConnected()) {
      await Message.deleteMany({ sessionId });
    }
    inMemoryMessages = [];
    res.json({ success: true, message: 'Chat history cleared successfully.' });
  } catch (error) {
    console.error('[API] Error clearing messages:', error);
    res.status(500).json({ success: false, error: 'Failed to clear chat history.' });
  }
});

export default router;
