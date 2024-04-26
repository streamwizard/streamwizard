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
  icon?: any
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