'use client';

import React, { useState, useEffect, useRef } from 'react';
import StatusHeader from './components/StatusHeader';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import OfflineBanner from './components/OfflineBanner';
import ThinkingIndicator from './components/ThinkingIndicator';
import Playground from './components/Playground';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001/api';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [latestScanData, setLatestScanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scanningTarget, setScanningTarget] = useState(null);
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
        setHealth({ status: 'offline', mongodb: 'offline' });
      }
    } catch (err) {
      console.warn('Backend server is currently offline or unreachable:', err);
      setHealth({ status: 'offline', mongodb: 'offline' });
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
          
          // Rehydrate scan data from the most recent message that contains it
          const lastMsgWithScan = [...data.messages].reverse().find(m => m.scanData);
          if (lastMsgWithScan) {
            setLatestScanData(lastMsgWithScan.scanData);
          }
        } else {
          setMessages([
            {
              role: 'assistant',
              content: 'Welcome to **Cyber Security Workspace**.\n\nAsk web security questions, audit code snippets for vulnerabilities, or request OWASP mitigation advice.',
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
          content: 'Welcome to **Cyber Security Workspace**.\n\n> ⚠️ Server connection unreachable. Please ensure `node server.js` is running in `backend/`.',
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
  const handleSendMessage = async (userPrompt, auth = null) => {
    if (!userPrompt || isLoading) return;

    const userMessageObj = {
      role: 'user',
      content: userPrompt,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setIsLoading(true);

    // Detect if this is a scan request so we can show the target URL in the loading screen
    const scanUrlMatch =
      userPrompt.match(/(?:scan|xss|dalfox|katana|gospider|hakrawler|arjun|playwright|find params?|crawl|test|check|vuln|recon|audit|analyze|analyse|pentest|hack|attack|probe)\s[\s\S]*?(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i) ||
      userPrompt.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)[\s\S]*?(?:scan|xss|dalfox|test|check|vuln|recon|audit|analyze|pentest|hack|probe)/i) ||
      userPrompt.match(/^(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)$/i) ||
      userPrompt.match(/scan[\s\S]*(https?:\/\/[^\s]+)/i);
    if (scanUrlMatch && scanUrlMatch[1]) {
      setScanningTarget(scanUrlMatch[1]);
    }

    try {
      // Scans can take 2-5 minutes — use an 8-minute timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000);

      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userPrompt, auth }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          setMessages((prev) => [...prev, data.message]);
          if (data.scanData) {
            setLatestScanData(data.scanData);
          }
        } else {
          throw new Error(data.error || 'Invalid API response format');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to process message`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('Scan timed out after 8 minutes');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⏱️ **Scan Timed Out**: The scan took longer than 8 minutes. This can happen if external tools (Katana, Dalfox) are running slowly. Try scanning a simpler target or check the backend terminal for progress.`,
            timestamp: new Date()
          }
        ]);
      } else {
        console.error('Error sending message:', err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ **Connection Error**: ${err.message}\n\nPlease check if the backend server is running on \`http://127.0.0.1:5001\`.`,
            timestamp: new Date()
          }
        ]);
      }
    } finally {
      setIsLoading(false);
      setScanningTarget(null);
      fetchHealth();
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
            content: 'History cleared.',
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

  const latestAiMessage = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#090d16]">
      
      {/* Minimalist Top Header */}
      <StatusHeader
        health={health}
        loadingHealth={loadingHealth}
        onRefresh={fetchHealth}
        onClearHistory={handleClearHistory}
        isClearing={isClearing}
      />

      {/* Offline Warning Banner */}
      <OfflineBanner isOffline={health?.status === 'offline'} />

      {/* Main Container - Split Layout */}
      <main className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Playground - always visible on lg+, shows scan results */}
        <div className="flex flex-1 min-w-0 bg-[#090d16] overflow-hidden flex-col">
          <Playground scanData={latestScanData} aiMessage={latestAiMessage} isLoading={isLoading} scanningTarget={scanningTarget} />
        </div>

        {/* Right Side: Chat Bot (IDE Sidebar Style) */}
        <div className="w-full lg:w-[400px] shrink-0 flex flex-col border-l border-slate-800 bg-[#0a101a] justify-between">
          
          {/* Message Container */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col custom-scrollbar">
            {messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))}

            {/* Minimal Loading Indicator */}
            <ThinkingIndicator isLoading={isLoading} />

            <div ref={messagesEndRef} />
          </div>

          {/* Minimalist Bottom Input */}
          <div className="w-full border-t border-slate-800/40 bg-[#0a101a] z-10 shrink-0">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          </div>
        </div>

      </main>

    </div>
  );
}
