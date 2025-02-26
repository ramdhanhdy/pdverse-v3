import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

export function isValidPdf(file: File): boolean {
  return file.type === 'application/pdf';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function truncateFilename(filename: string, maxLength = 25): string {
  if (filename.length <= maxLength) return filename;
  
  const extension = getFileExtension(filename);
  const nameWithoutExtension = filename.slice(0, filename.lastIndexOf('.'));
  
  const truncatedName = nameWithoutExtension.slice(0, maxLength - extension.length - 3) + '...';
  return `${truncatedName}.${extension}`;
}
