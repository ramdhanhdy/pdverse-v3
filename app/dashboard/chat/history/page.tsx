"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ChatSession = {
  id: string;
  title: string;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
  attachedFiles?: {
    id: number;
    name: string;
  }[];
};

// Mock data for chat history
const mockChatHistory: ChatSession[] = [
  {
    id: "chat-1",
    title: "Climate Report Discussion",
    preview: "Can you tell me more about the recommended actions in the report?",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    attachedFiles: [
      {
        id: 1,
        name: "Climate_Report_2023.pdf",
      },
    ],
  },
  {
    id: "chat-2",
    title: "Financial Statement Analysis",
    preview: "What are the key insights from this quarterly financial report?",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 23), // 23 hours ago
    attachedFiles: [
      {
        id: 2,
        name: "Q2_Financial_Report.pdf",
      },
    ],
  },
  {
    id: "chat-3",
    title: "Research Paper Review",
    preview: "Can you summarize the methodology section of this research paper?",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 47), // 47 hours ago
    attachedFiles: [
      {
        id: 3,
        name: "Machine_Learning_Research.pdf",
      },
    ],
  },
  {
    id: "chat-4",
    title: "Contract Analysis",
    preview: "What are the key terms and conditions in this contract?",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 70), // 70 hours ago
    attachedFiles: [
      {
        id: 4,
        name: "Service_Agreement_2023.pdf",
      },
    ],
  },
  {
    id: "chat-5",
    title: "General Questions",
    preview: "How can I extract text from a PDF programmatically?",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96), // 4 days ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 95), // 95 hours ago
  },
];

export default function ChatHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(mockChatHistory);

  // Filter chat history based on search query
  const filteredChatHistory = chatHistory.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.attachedFiles?.some((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  // Format date to relative time (e.g., "2 hours ago")
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return "just now";
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths === 1 ? "" : "s"} ago`;
    }
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears === 1 ? "" : "s"} ago`;
  };

  const deleteChat = (id: string) => {
    setChatHistory((prev) => prev.filter((chat) => chat.id !== id));
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Chat History</h1>
        <Link href="/dashboard/chat">
          <Button>New Chat</Button>
        </Link>
      </div>

      <div className="mb-8">
        <Input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filteredChatHistory.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
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
              className="h-10 w-10 text-muted-foreground"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-3">No conversations found</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery
              ? "Try a different search term or clear your search to see all conversations"
              : "Start a new chat to begin asking questions about your PDF documents"}
          </p>
          <Link href="/dashboard/chat">
            <Button size="lg" className="px-6">Start a new chat</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredChatHistory.map((chat) => (
            <Card key={chat.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="truncate">{chat.title}</CardTitle>
                <CardDescription>
                  Created {formatRelativeTime(chat.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {chat.preview}
                </p>
                {chat.attachedFiles && chat.attachedFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chat.attachedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
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
                          className="h-3 w-3"
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="truncate max-w-[100px]">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(chat.updatedAt)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteChat(chat.id)}
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
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    <span className="sr-only">Delete</span>
                  </Button>
                  <Link href={`/dashboard/chat/${chat.id}`}>
                    <Button size="sm">View</Button>
                  </Link>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
