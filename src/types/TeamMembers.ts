import { Media } from "./ImageSizes"
import { Socialmedia } from "./payload";

export interface TeamMemberRoot {
  docs: TeamMember[];
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


interface TeamMember{
  id: string
  gamertag: string
  name: string
  teams: any
  socials: Socialmedia[]
  image: Media
  createdAt: Date;
  updatedAt: Date;
}


