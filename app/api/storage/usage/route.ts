import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    // In a real implementation, you would calculate actual storage usage
    // For now, we'll return mock data
    // This could be enhanced to check IndexedDB or localStorage size
    
    // Mock data for demonstration
    const mockUsage = {
      used: 25 * 1024 * 1024, // 25MB in bytes
      total: 100 * 1024 * 1024, // 100MB in bytes
    };
    
    return NextResponse.json(mockUsage);
  } catch (error) {
    console.error('Error getting storage usage:', error);
    return NextResponse.json(
      { error: 'Failed to get storage usage' },
      { status: 500 }
    );
  }
}
