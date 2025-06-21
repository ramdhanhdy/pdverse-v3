import React from 'react';
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PdfViewerProps {
  fileUrl: string;
  onDocumentLoad?: (numPages: number) => void;
  initialPage?: number;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  fileUrl, 
  onDocumentLoad,
  initialPage = 1
}) => {
  // Create the default layout plugin instance
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => defaultTabs.slice(0, 2), // Only show thumbnails and outline
  });

  return (
    <div className="h-full w-full">
      <Worker workerUrl={`https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js`}>
        <Viewer
          fileUrl={fileUrl}
          plugins={[defaultLayoutPluginInstance]}
          defaultScale={SpecialZoomLevel.PageWidth}
          theme="auto"
          onDocumentLoad={(e) => {
            if (onDocumentLoad) {
              onDocumentLoad(e.doc.numPages);
            }
          }}
          renderError={(error) => (
            <div className="flex flex-col items-center justify-center p-5 text-center">
              <p className="text-red-500 font-medium mb-2">Failed to load PDF</p>
              <p className="text-sm text-gray-500">{error.message}</p>
            </div>
          )}
        />
      </Worker>
    </div>
  );
};

export default PdfViewer; 