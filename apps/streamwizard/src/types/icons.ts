import { LucideIcon } from "lucide-react";

/**
 * Represents a Lucide icon component.
 * This type can be used for props, lookup tables, or any variable holding a Lucide icon.
 * 
 * @example
 * ```tsx
 * import { IconType } from "@/types/icons";
 * import { Settings } from "lucide-react";
 * 
 * const MyComponent = ({ icon: Icon }: { icon: IconType }) => <Icon size={20} />;
 * ```
 */
export type IconType = LucideIcon;

/**
 * Common interface for components that require an icon
 */
export interface WithIcon {
    icon: IconType;
}

/**
 * Type representing all valid Lucide icon names as strings.
 * Useful for storing icon names in a database or passing them as props.
 */
export type IconName = keyof typeof import("lucide-react").icons;
