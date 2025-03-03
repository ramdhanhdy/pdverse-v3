"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

// Mock function to get chat session (in a real app, this would be an API call)
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
      // In a real app, fetch the chat session from an API
      setChatSession(getChatSession(params.id as string));
    }
  }, [params.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatSession?.messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !chatSession) return;

    // Add user message
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

    // Simulate AI response after a delay
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, but this is a historical chat view. To continue the conversation, please start a new chat session.",
        timestamp: new Date(),
      };

      setChatSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, assistantMessage],
        };
      });

      setIsLoading(false);
    }, 1000);
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
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => router.push("/dashboard/chat")}
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
          <div className="flex-1 overflow-y-auto p-4">
            {chatSession.messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-3/4 rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="mt-1 text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {chatSession.attachedFiles && chatSession.attachedFiles.length > 0 && (
            <div className="border-t p-2 bg-muted/50">
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
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
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
                    className="h-4 w-4 mr-2"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                )}
                Send
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
