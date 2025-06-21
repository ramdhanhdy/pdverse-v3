"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readDataStream } from 'ai/sdk';

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
  attachedFiles?: {
    id: number;
    name: string;
  }[];
};

// Function to fetch chat session from API
const fetchChatSession = async (id: string): Promise<ChatSession> => {
  try {
    const response = await fetch(`/api/chat/sessions/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch chat session');
    }
    const data = await response.json();
    
    // Convert string timestamps to Date objects
    const messages = data.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
    
    return {
      ...data,
      messages,
      createdAt: new Date(data.createdAt)
    };
  } catch (error) {
    console.error('Error fetching chat session:', error);
    // Fallback to mock data if API fails
    return getChatSession(id);
  }
};

// Mock function as fallback
const getChatSession = (id: string): ChatSession => {
  const mockMessages: Message[] = [
    {
      id: "assistant-1",
      role: "assistant",
      content: "Hello! How can I help you with your PDF documents today?",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
    },
    {
      id: "user-1",
      role: "user",
      content: "I have a PDF about climate change. Can you summarize it for me?",
      timestamp: new Date(Date.now() - 1000 * 60 * 29),
    },
    {
      id: "assistant-2",
      role: "assistant",
      content: "I'd be happy to help summarize your climate change document. Could you please attach the PDF so I can analyze its contents?",
      timestamp: new Date(Date.now() - 1000 * 60 * 28),
    },
    {
      id: "user-2",
      role: "user",
      content: "I've attached the document 'Climate_Report_2023.pdf'",
      timestamp: new Date(Date.now() - 1000 * 60 * 27),
    },
    {
      id: "assistant-3",
      role: "assistant",
      content: "Thank you for sharing the Climate Report 2023. Based on my analysis, the document covers the following key points:\n\n1. Global temperatures have risen by 1.1°C since pre-industrial times\n2. Carbon emissions continue to increase despite mitigation efforts\n3. Sea levels are rising at an accelerated rate\n4. Extreme weather events are becoming more frequent\n5. The report recommends immediate action to reduce emissions by 45% by 2030\n\nWould you like me to elaborate on any specific section of the report?",
      timestamp: new Date(Date.now() - 1000 * 60 * 25),
    },
    {
      id: "user-3",
      role: "user",
      content: "Can you tell me more about the recommended actions in the report?",
      timestamp: new Date(Date.now() - 1000 * 60 * 24),
    },
    {
      id: "assistant-4",
      role: "assistant",
      content: "Certainly! The Climate Report 2023 outlines several recommended actions:\n\n1. **Immediate Emission Reductions**: Cut global carbon emissions by 45% by 2030 and reach net-zero by 2050\n\n2. **Renewable Energy Transition**: Accelerate the shift from fossil fuels to renewable energy sources like solar, wind, and hydroelectric power\n\n3. **Energy Efficiency Improvements**: Implement stricter building codes and industrial standards to reduce energy consumption\n\n4. **Transportation Reform**: Electrify public and private transportation systems and improve public transit infrastructure\n\n5. **Carbon Pricing**: Establish effective carbon pricing mechanisms to incentivize emission reductions\n\n6. **Natural Carbon Sinks**: Protect and restore forests, wetlands, and other ecosystems that absorb carbon\n\n7. **Climate Finance**: Developed countries should fulfill their pledge to provide $100 billion annually to support climate action in developing nations\n\n8. **Adaptation Measures**: Invest in infrastructure and systems to adapt to already unavoidable climate impacts\n\nThe report emphasizes that these actions require coordination at international, national, and local levels, with particular responsibility falling on developed nations and major emitters.",
      timestamp: new Date(Date.now() - 1000 * 60 * 22),
    },
  ];

  return {
    id,
    title: "Climate Report Discussion",
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    messages: mockMessages,
    attachedFiles: [
      {
        id: 1,
        name: "Climate_Report_2023.pdf",
      },
    ],
  };
};

export default function ChatHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params.id) {
      // Fetch the chat session from the API
      fetchChatSession(params.id as string).then(setChatSession);
    }
  }, [params.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatSession?.messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !chatSession) return;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setChatSession({
      ...chatSession,
      messages: [...chatSession.messages, userMessage],
    });

    setInput("");
    setIsLoading(true);

    try {
      // Prepare messages for API in the format expected by the API
      const apiMessages = chatSession.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add the new user message
      apiMessages.push({
        role: "user",
        content: userMessage.content
      });

      // Get file IDs if any are attached
      const fileIds = chatSession.attachedFiles?.map(file => file.id) || [];

      // Make API call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          fileIds,
          chatId: chatSession.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from API');
      }

      // Create temporary assistant message
      const tempAssistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setChatSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, tempAssistantMessage]
      } : prev);

      // Process the stream using AI SDK utilities
      let accumulatedContent = '';
      const reader = response.body?.getReader();
      
      if (reader) {
        for await (const { type, value } of readDataStream(reader)) {
          if (type === 'text') {
            accumulatedContent += value;
            
            // Update UI incrementally
            setChatSession(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map(msg => 
                  msg.id === tempAssistantMessage.id 
                    ? { ...msg, content: accumulatedContent } 
                    : msg
                )
              };
            });
          }
        }
      }

      // Final message update
      const assistantMessage: Message = {
        ...tempAssistantMessage,
        content: accumulatedContent
      };

      setChatSession((prev) => {
        if (!prev) return prev;
        
        // Check for existing pending assistant message
        const hasPending = prev.messages.some(m => 
          m.role === 'assistant' && m.content === ''
        );

        return {
          ...prev,
          messages: hasPending
            ? prev.messages.map(m => 
                m.role === 'assistant' && m.content === '' 
                  ? assistantMessage 
                  : m
              )
            : [...prev.messages, assistantMessage]
        };
      });
      
      // Update the chat session in the database
      await fetch(`/api/chat/sessions/${chatSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...chatSession.messages, userMessage, assistantMessage]
        }),
      });
      
    } catch (error) {
      console.error('Error in chat API call:', error);
      
      // Show error message
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, there was an error processing your request. Please try again later.",
        timestamp: new Date(),
      };

      setChatSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, errorMessage],
        };
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!chatSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading chat history...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full">
        <div className="mb-4 flex flex-col space-y-1.5">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => router.push("/dashboard/chat")}
              variant="outline"
              size="icon"
              className="h-8 w-8"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{chatSession.title}</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {chatSession.createdAt.toLocaleString()}
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-0">
            <div className="flex-1 overflow-y-auto p-6">
              {chatSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-6 flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className="mt-2 text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {chatSession.attachedFiles && chatSession.attachedFiles.length > 0 && (
              <div className="border-t p-3 bg-muted/50">
                <div className="text-sm font-medium mb-2">Attached Files:</div>
                <div className="flex flex-wrap gap-2">
                  {chatSession.attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="This is a historical view. Start a new chat to continue..."
                  className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending
                    </span>
                  ) : (
                    "Send"
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
