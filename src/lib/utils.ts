import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalizeFirstLetter(inputString: string) {
  return inputString.replace(/\b\w/g, function (match) {
    return match.toUpperCase();
  });
}

export function parseEncodedDate(encodedDateString: string | null | undefined): Date {
  // Handle null or undefined input, or invalid date
  if (!encodedDateString) return new Date();

  try {
      // Decode the URL-encoded string
      const decodedDateString = decodeURIComponent(encodedDateString);
      
      // Create a Date object
      const dateObject = new Date(decodedDateString);
      
      // Return the date if valid, otherwise return current date
      return isNaN(dateObject.getTime()) ? new Date() : dateObject;
  } catch (error) {
      // If any error occurs during parsing, return current date
      return new Date();
  }
}