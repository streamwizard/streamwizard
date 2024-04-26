
import { Media } from "./ImageSizes"

export interface Investors {
  docs: Team[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage?: any;
  nextPage?: any; 
}


interface Team{
  id: string
  description: string
  image: Media
  createdAt: Date;
  updatedAt: Date;
}