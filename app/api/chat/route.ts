// File: app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import db from '@/lib/db';


export async function POST(req: NextRequest) {
  try {
    const { messages, fileIds, chatId, model = 'gpt-4o', temperature = 0.7, maxTokens = 4096, chatMode = 'general' } = await req.json();
    console.log('Chat API received:', { messages, fileIds, chatId, model, temperature, maxTokens, chatMode });
    
    

    // Use Vercel AI SDK
    try {
      // Create a custom OpenAI provider instance with the API key
            const customOpenAI = process.env.OPENAI_API_KEY
        ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : createOpenAI();

      let systemMessageContent = "You are a helpful AI assistant. Analyze the user's query and any provided documents to give an accurate and helpful response.";

      if (chatMode === 'document' && fileIds && fileIds.length > 0) {
        const queryText = 'SELECT original_filename, content FROM files WHERE id = ANY($1::text[])';
        const { rows: documents } = await db.query(queryText, [fileIds]);
        if (documents.length > 0) {
          const documentContent = documents.map((doc: { original_filename: string; content: string }) => `Document: ${doc.original_filename}\nContent:\n${doc.content || ''}`).join('\n\n');
          systemMessageContent += `\n\nHere are the documents to reference:\n${documentContent}`;
        }
      }

      const lastMessage = messages[messages.length - 1];
      const userContent = typeof lastMessage.content === 'string' ? lastMessage.content : '';

                        const streamResult = await streamText({
        // Use the 'chat' method of the custom provider to get the model
        model: customOpenAI(model),
        system: systemMessageContent,
        messages: [...messages.slice(0, -1), { role: 'user', content: userContent }],
        temperature,
        maxTokens,
      });
      
            // Convert streamed result to a standard Response object for Next.js
      return streamResult.toTextStreamResponse();
    } catch (error) {
      console.error('AI SDK Error:', error);
      return new Response(JSON.stringify({ error: 'An error occurred with the AI SDK.' }), { status: 500 });
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process your request' },
      { status: 500 }
    );
  }
}