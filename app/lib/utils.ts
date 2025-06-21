import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function truncateFilename(filename: string, maxLength = 30) {
  if (filename.length <= maxLength) return filename;
  
  const extension = filename.split('.').pop();
  const baseName = filename.slice(0, filename.lastIndexOf('.'));
  const maxBaseLength = maxLength - (extension?.length || 0) - 1; // -1 for the dot
  
  if (maxBaseLength <= 0) return filename;
  
  return baseName.length > maxBaseLength 
    ? `${baseName.slice(0, maxBaseLength/2)}…${baseName.slice(-maxBaseLength/2 + 1)}.${extension}`
    : `${baseName}.${extension}`;
}

export function isValidPdf(file: File) {
  return file.type === 'application/pdf' && 
         file.name.toLowerCase().endsWith('.pdf');
} 