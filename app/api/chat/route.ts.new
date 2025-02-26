import { streamText } from 'ai';
import { Configuration, OpenAIApi } from 'openai-edge';
import { openai } from '@ai-sdk/openai';

// Create an OpenAI API client (that's edge friendly!)
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY || '',
});
const openaiApi = new OpenAIApi(config);

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, fileIds, model = 'gpt-4o', temperature = 0.7, maxTokens = 4096 } = await req.json();
    
    // Add system message for context
    let systemContent = 'You are an AI assistant specialized in helping users with PDF documents. You can analyze content, extract information, and answer questions about documents.';

    // If fileIds exist, add a mention of them
    if (fileIds && fileIds.length > 0) {
      systemContent += ` The user has attached ${fileIds.length} PDF document(s). Please help analyze these documents based on the user's questions.`;
    }

    // Use the model from settings, fallback to gpt-4o
    const response = streamText({
      model: openai(model),
      system: systemContent,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      maxTokens: maxTokens,
      temperature: temperature,
    });

    // Return the streaming response
    return response.toDataStreamResponse();
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'Failed to process your request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
