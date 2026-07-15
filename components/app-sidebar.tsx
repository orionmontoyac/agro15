"use client"

import * as React from "react"
import Image from "next/image"

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
import { LayoutDashboardIcon, UsersIcon, DatabaseIcon, FileChartColumnIcon, FileIcon, CloudRainIcon, FlaskConicalIcon, InfoIcon, CalculatorIcon } from "lucide-react"

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
    {
      title: "Lluvias",
      url: "/lluvias",
      icon: <CloudRainIcon />,
    },
    {
      title: "Insumos",
      url: "/insumos",
      icon: <FlaskConicalIcon />,
    },
    {
      title: "Proyecciones",
      url: "/proyecciones",
      icon: <CalculatorIcon />,
    },
    {
      title: "Créditos",
      url: "/credits",
      icon: <InfoIcon />,
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
              className="data-[slot=sidebar-menu-button]:p-2!"
              render={<a href="/dashboard" />}
            >
              <Image
                src="/icon.png"
                alt="Agro15"
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-md"
              />
              <span className="text-base font-semibold text-primary">Agro15</span>
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
