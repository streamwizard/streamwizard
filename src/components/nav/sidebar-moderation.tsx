"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { Users, MessageSquare, ChevronRight } from "lucide-react";

export default function SidebarModeration() {
  return (
    <SidebarMenu>
      {/* User Management Section */}
      <Collapsible asChild defaultOpen={false} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip="User Management">
              <Users className="mr-2 h-4 w-4" />
              <span>User Management</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Banned Users</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Unban Requests</span>
                  <Badge variant="default" className="ml-auto">
                    New
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Moderators</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>VIPs</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Suspicious Users</span>
                  <Badge variant="outline" className="ml-auto">
                    Beta
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      {/* Chat Management Section */}
      <Collapsible asChild defaultOpen={false} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip="Chat Management">
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Chat Management</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>AutoMod</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Blocked Terms</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Delete Messages</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Warn Users</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton>
                  <span>Shield Mode</span>
                  <Badge variant="secondary" className="ml-auto">
                    Soon
                  </Badge>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
}
