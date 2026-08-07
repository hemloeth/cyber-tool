'use client';

import React, { useState, useEffect, useRef } from 'react';
import StatusHeader from './components/StatusHeader';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import OfflineBanner from './components/OfflineBanner';
import ThinkingIndicator from './components/ThinkingIndicator';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001/api';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Fetch backend health status
  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth({ status: 'offline', mongodb: 'offline', groq: 'offline' });
      }
    } catch (err) {
      console.warn('Backend server is currently offline or unreachable:', err);
      setHealth({ status: 'offline', mongodb: 'offline', groq: 'offline' });
    } finally {
      setLoadingHealth(false);
    }
  };

  // Fetch initial chat messages from backend
  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/messages`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([
            {
              role: 'assistant',
              content: '👋 Welcome to **Cyber AI Brain**! I am your cybersecurity discovery & analysis AI agent.\n\nType `Scan https://example.com` or ask any security question to get started.',
              timestamp: new Date()
            }
          ]);
        }
      }
    } catch (err) {
      console.warn('Could not fetch message history:', err);
      setMessages([
        {
          role: 'assistant',
          content: '👋 Welcome to **Cyber AI Brain**!\n\n> ⚠️ Note: Backend server (`http://127.0.0.1:5001`) is offline. Please start the Express server in `backend/` using `npm run dev` or `node server.js`.',
          timestamp: new Date()
        }
      ]);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchMessages();
  }, []);

  // Send prompt to Express API
  const handleSendMessage = async (userPrompt) => {
    if (!userPrompt || isLoading) return;

    const userMessageObj = {
      role: 'user',
      content: userPrompt,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userPrompt })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          setMessages((prev) => [...prev, data.message]);
        } else {
          throw new Error(data.error || 'Invalid API response format');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to process message`);
      }
    } catch (err) {
      console.error('Error sending chat message:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Connection Error**: ${err.message}\n\nPlease check if the Express backend server is running on \`http://127.0.0.1:5001\`.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
      fetchHealth(); // Update status indicators
    }
  };

  // Clear chat history
  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/messages`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([
          {
            role: 'assistant',
            content: '🧹 Chat history has been cleared.',
            timestamp: new Date()
          }
        ]);
      }
    } catch (err) {
      console.error('Error clearing history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* Top Header & Status Bar */}
      <StatusHeader
        health={health}
        loadingHealth={loadingHealth}
        onRefresh={fetchHealth}
        onClearHistory={handleClearHistory}
        isClearing={isClearing}
      />

      {/* Offline Warning Banner Micro-Component */}
      <OfflineBanner isOffline={health?.status === 'offline'} />

      {/* Main Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 flex flex-col">
        
        {/* Message Stream */}
        <div className="flex-1 glass-panel rounded-2xl p-4 overflow-y-auto max-h-[60vh] min-h-[380px] flex flex-col">
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}

          {/* Thinking Loading Indicator Micro-Component */}
          <ThinkingIndicator isLoading={isLoading} />

          <div ref={messagesEndRef} />
        </div>

      </main>

      {/* Bottom Chat Input */}
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />

    </div>
  );
}
