interface Thumbnail {
  width: number;
  height: number;
  mimeType: string;
  filesize: number;
  filename: string;
  url: string;
}

interface Card {
  width: number;
  height: number;
  mimeType: string;
  filesize: number;
  filename: string;
  url: string;
}

interface Tablet {
  width: number;
  height: number;
  mimeType: string;
  filesize: number;
  filename: string;
  url: string;
}

interface Sizes {
  thumbnail: Thumbnail;
  card: Card;
  tablet: Tablet;
}

export interface Media {
  id: string;
  alt: string;
  sizes: Sizes;
  filename: string;
  mimeType: string;
  filesize: number;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
  url: string;
}