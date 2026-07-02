"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, UsersIcon, DatabaseIcon, FileChartColumnIcon, FileIcon, SproutIcon } from "lucide-react"

const data = {
  user: {
    name: "Usuario",
    email: "usuario@agro15.co",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Inicio",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Productos",
      url: "/products",
      icon: <UsersIcon />,
    },
  ],
  documents: [
    {
      name: "Granadilla",
      url: "/products/106",
      icon: <DatabaseIcon />,
    },
    {
      name: "Tomate",
      url: "/products/46",
      icon: <FileChartColumnIcon />,
    },
    {
      name: "Gulupa",
      url: "/products/113",
      icon: <FileIcon />,
    },
  ],
}
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <SproutIcon className="size-5! text-primary" />
              <span className="text-base font-semibold text-primary">agro15</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
