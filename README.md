# PDVerse - PDF Management System with AI Chat

PDVerse is a powerful PDF management system with integrated AI chat capabilities. The application allows users to upload, organize, view, and analyze PDF documents while leveraging AI to assist with content extraction, summarization, and question answering.

## Features

- **PDF Management**: Upload, organize, view, and delete PDF documents
- **File Organization**: Create folders, tag documents, and search through your collection
- **PDF Viewer**: Built-in PDF viewer with annotation capabilities
- **AI Chat Assistant**: Get help with document analysis, content extraction, and general questions
  - Chat with AI about your PDF documents
  - Ask questions about document content
  - Get summaries and key insights
  - Extract specific information from documents
  - Save chat history for future reference
- **Local Operation**: Application runs locally with optional cloud AI API integration
- **User Authentication**: Secure access to your document collection

## Technology Stack

- Next.js for the frontend and API routes
- React for the UI components
- Tailwind CSS for styling
- Shadcn UI component library
- Local PDF processing libraries
- Integration with AI APIs for chat functionality

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables (see `.env.example`)
4. Run the development server with `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file with the following variables:

```
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# OpenAI API for Chat Functionality
OPENAI_API_KEY=your-openai-api-key

# Database (Optional for future implementation)
# DATABASE_URL=your-database-url
```

## AI Chat Functionality

PDVerse integrates with OpenAI's API to provide intelligent chat capabilities:

1. **Document-Specific Chats**: Attach a PDF to your chat to ask questions about its content
2. **General PDF Assistance**: Get help with PDF-related tasks and questions
3. **Chat History**: View and continue previous conversations
4. **Customizable AI Settings**: Configure the AI model, temperature, and other parameters

To use the AI chat functionality:
1. Set up your OpenAI API key in the settings page or `.env.local` file
2. Navigate to the Chat section from the dashboard
3. Start a new chat or select a document to discuss
4. Your conversations are saved locally for future reference

## License

MIT
