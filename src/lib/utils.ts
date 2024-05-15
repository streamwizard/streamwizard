import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function msToTime(duration: number) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60);

  return minutes + ":" + seconds;
}

export function secondsToHoursMinutesSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours}:${minutes}`;
}


// create a function that converts seconds to minutes
export function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}
