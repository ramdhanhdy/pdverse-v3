// File: app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { queryDocumentWithLLM, generalChat } from '@/lib/python-backend';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages, fileIds, chatId, model = 'gpt-4o', temperature = 0.7, maxTokens = 4096, chatMode = 'general', usePythonBackend = false } = await req.json();
    console.log('Chat API received:', { messages, fileIds, chatId, model, temperature, maxTokens, chatMode, usePythonBackend });

    // Document mode: Proxy to Python backend
    if (fileIds && fileIds.length > 0) {
      console.log('Document mode: Calling Python backend with streaming');
      const lastUserMessage = messages[messages.length - 1];
      if (!lastUserMessage || lastUserMessage.role !== 'user') throw new Error('No user message found');
      
      // Log the actual message being sent to ensure it's correct
      console.log('Document mode: Using message:', lastUserMessage.content);
      
      // Call the Python backend with streaming enabled
      const response = await queryDocumentWithLLM(
        lastUserMessage.content, 
        fileIds[0], 
        'document',
        true // Enable streaming
      );
      
      // Return the streaming response directly
      if (response instanceof Response) {
        console.log('Returning streaming response from Python backend for document mode');
        // Make sure the response has the correct headers for text streaming
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'text/plain');
        newHeaders.set('Cache-Control', 'no-cache');
        newHeaders.set('Connection', 'keep-alive');
        
        // Return the response with the correct headers
        // This will be compatible with streamProtocol: 'text' in the frontend
        return new Response(response.body, {
          headers: newHeaders,
          status: response.status,
          statusText: response.statusText,
        });
      }
      
      // Fallback if we got a non-streaming response
      console.log('Got non-streaming response from Python backend for document mode, converting to stream');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Format the response as OpenAI-compatible streaming chunks
          // First send the role
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {
                role: 'assistant'
              }
            }]
          })}\n\n`));
          
          // Then send the content
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {
                content: response.response
              }
            }]
          })}\n\n`));
          
          // Send the "done" message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          })}\n\n`));
          
          // Send the final [DONE] message
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          
          controller.close();
        },
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // General mode: Use Python backend if specified
    if (usePythonBackend) {
      console.log('General mode: Calling Python backend with streaming');
      
      // Log the messages being sent to ensure they're correct
      console.log('General mode: Using messages:', JSON.stringify(messages));
      
      const response = await generalChat(messages, {
        model,
        temperature,
        maxTokens,
        stream: true
      });
      
      // Return the streaming response directly
      if (response instanceof Response) {
        console.log('Returning streaming response from Python backend');
        // Make sure the response has the correct headers for text streaming
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'text/plain');
        newHeaders.set('Cache-Control', 'no-cache');
        newHeaders.set('Connection', 'keep-alive');
        
        // Return the response with the correct headers
        // This will be compatible with streamProtocol: 'text' in the frontend
        return new Response(response.body, {
          headers: newHeaders,
          status: response.status,
          statusText: response.statusText,
        });
      }
      
      // Fallback if we got a non-streaming response
      console.log('Got non-streaming response from Python backend, converting to stream');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // First send the role
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {
                role: 'assistant'
              }
            }]
          })}\n\n`));
          
          // Then send the content
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {
                content: response.response
              }
            }]
          })}\n\n`));
          
          // Send the "done" message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          })}\n\n`));
          
          // Send the final [DONE] message
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // General mode: Use OpenAI directly via AI SDK with streaming
    console.log('General mode: Calling OpenAI via AI SDK');
    const result = await streamText({
      model: openai(model),
      messages,
      temperature,
      maxTokens,
    });

    console.log('Stream initiated, returning response');
    // Use the streaming text response for AI SDK 4.1.46
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process your request' },
      { status: 500 }
    );
  }
}