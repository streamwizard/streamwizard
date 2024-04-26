export interface Socials {
  socials: Social[]
  globalType: string
  createdAt: string
  updatedAt: string
  id: string
}


export interface Social {
  platform: string
  link: string
  id: string
}