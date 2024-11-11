import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  disabled?: boolean
}

export type MainNavItem = NavItem

export type SidebarNavItem = {
  label: string
  href: string
  icon: LucideIcon
  disabled?: boolean
  premium?: boolean
  new?: boolean
  beta? : boolean
  commingSoon?: boolean
}

export type DashboardSection = {
  title?: string
  routes: SidebarNavItem[]
}

export type DashboardConfig = {
  [sectionKey: string]: DashboardSection
}

export type MenuConfig = {
  features: NavItem[]
}

declare module "axios" {
  export interface AxiosRequestConfig {
    user_id?: string; // Your custom property
    broadcasterID?: string; // Your custom property
    // Add more custom properties as needed
  }
}
