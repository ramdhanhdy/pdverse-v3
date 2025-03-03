// api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages, fileIds, chatId, model = 'gpt-4o', temperature = 0.7, maxTokens = 4096, data, chatMode } = await req.json();
    console.log('Chat API received:', { messages, fileIds, chatId, model, temperature, maxTokens, data });

    // Handle Python backend response if provided
    if (data?.pythonBackendResponse) {
      console.log('Returning pythonBackendResponse:', data.pythonBackendResponse);
      return NextResponse.json({ content: data.pythonBackendResponse, chatId });
    }

    // Document mode: Call Python backend
    if (fileIds && fileIds.length > 0) {
      console.log('Document mode: Calling Python backend');
      const lastUserMessage = messages.find((m: any) => m.role === 'user');
      if (!lastUserMessage) {
        throw new Error('No user message found');
      }

      const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured in environment');
      }

      const response = await fetch(`${pythonBackendUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: lastUserMessage.content,
          document_id: fileIds[0],
          chat_mode: 'document',
          api_key: apiKey,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Python backend error:', errorText);
        throw new Error(`Failed to query Python backend: ${errorText}`);
      }

      const result = await response.json();
      console.log('Python backend response:', result);
      return NextResponse.json({ content: result.response, chatId });
    }

    // General mode: Direct OpenAI call with streamText
    if (chatMode === 'general') {
      console.log('Explicit general mode: Using OpenAI');
      // Direct OpenAI call with general system prompt
      const systemContent = 'You are a helpful AI assistant';
      const response = await streamText({
        model: openai(model),
        system: systemContent,
        messages: messages.map((msg: any) => ({ role: msg.role, content: msg.content })),
        temperature,
        maxTokens,
      });
      return response.toDataStreamResponse();
    }

    // General mode: Direct OpenAI call with streamText
    console.log('General mode: Using OpenAI fallback');
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured in environment');
    }

    console.log('Initiating streamText with model:', model);
    const systemContent = 'You are an AI assistant specialized in helping users with PDF documents. You can analyze content, extract information, and answer questions about documents.';
    const response = await streamText({
      model: openai(model),
      system: systemContent,
      messages: messages.map((msg: any) => ({ role: msg.role, content: msg.content })),
      temperature,
      maxTokens,
    });

    console.log('streamText response initiated');
    // Return streaming response directly for useChat
    return response.toDataStreamResponse();
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process your request' },
      { status: 500 }
    );
  }
}