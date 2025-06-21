"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, isValidPdf } from "@/lib/utils";
import { toast } from "sonner";
import { uploadFileToPythonBackend } from "@/lib/python-backend";

type UploadFile = {
  id: string;
  file: File;
  progress: number;
  error?: string;
  status: "pending" | "uploading" | "success" | "error";
};

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles
      .filter((file) => isValidPdf(file))
      .map((file) => ({
        id: Math.random().toString(36).substring(2, 15),
        file,
        progress: 0,
        status: "pending" as const,
      }));

    if (newFiles.length !== acceptedFiles.length) {
      toast.error("Some files were rejected. Only PDF files are allowed.");
    }

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const uploadFiles = async () => {
    try {
      const formData = new FormData();
      files.forEach(fileItem => {
        formData.append("file", fileItem.file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      toast.success("Files uploaded successfully");
      router.push("/dashboard/files");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File processing failed");
    }
  };

  const cancelUpload = () => {
    setFiles([]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Upload PDF Files</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
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
                <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
                <path d="M12.56 6.6A6 6 0 0 0 16 17.88" />
                <path d="M17 20.25a6 6 0 0 0 .24-11.88" />
              </svg>
              <div>
                <p className="text-base font-medium">
                  {isDragActive
                    ? "Drop your PDF files here"
                    : "Drag & drop your PDF files here"}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse files
                </p>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-medium">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </div>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 rounded-lg border p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
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
                        className="h-5 w-5 text-primary"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{file.file.name}</p>
                        {file.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
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
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                            <span className="sr-only">Remove</span>
                          </Button>
                        )}
                        {file.status === "success" && (
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
                            className="h-5 w-5 text-green-500"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        )}
                        {file.status === "error" && (
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
                            className="h-5 w-5 text-red-500"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" x2="12" y1="8" y2="12" />
                            <line x1="12" x2="12.01" y1="16" y2="16" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>{formatBytes(file.file.size)}</span>
                      </div>
                      {(file.status === "uploading" || file.status === "success") && (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${
                              file.status === "success"
                                ? "bg-green-500"
                                : "bg-primary"
                            }`}
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                      {file.error && (
                        <p className="text-xs text-red-500">{file.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/files")}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            {files.length > 0 && files.some(f => f.status === "pending") && (
              <Button onClick={uploadFiles}>
                Upload {files.length} file{files.length !== 1 ? "s" : ""}
              </Button>
            )}
            {files.length > 0 && files.every(f => f.status === "success") && (
              <Button onClick={() => router.push("/dashboard/files")}>
                Go to Files
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
