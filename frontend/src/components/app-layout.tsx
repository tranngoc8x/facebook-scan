import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
    LayoutDashboard,
    Users,
    Home,
    FileText,
    MessageSquare,
    Settings,
    ScanSearch,
    FolderKanban,
    History,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "FB Accounts", url: "/fb-accounts", icon: Users },
    { title: "Posts", url: "/rooms", icon: Home },
    { title: "Groups", url: "/groups", icon: FolderKanban },
    { title: "Post History", url: "/post-history", icon: History },
    { title: "Scanned Posts", url: "/posts", icon: FileText },
    { title: "Comments", url: "/comments", icon: MessageSquare },
    { title: "Settings", url: "/settings", icon: Settings },
];

export default function AppLayout() {
    const location = useLocation();

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader className="p-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <ScanSearch className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">FB Scanner</span>
                            <span className="text-xs text-muted-foreground">v1.0.0</span>
                        </div>
                    </div>
                </SidebarHeader>
                <Separator />
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={
                                                item.url === "/"
                                                    ? location.pathname === "/"
                                                    : location.pathname.startsWith(item.url)
                                            }
                                        >
                                            <NavLink to={item.url}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Auto Scan: Active</span>
                    </div>
                </SidebarFooter>
            </Sidebar>

            <main className="flex-1 overflow-auto">
                <header className="flex h-12 items-center gap-2 border-b px-4">
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-sm text-muted-foreground">
                        {navItems.find(
                            (n) =>
                                n.url === "/"
                                    ? location.pathname === "/"
                                    : location.pathname.startsWith(n.url)
                        )?.title || "Dashboard"}
                    </span>
                </header>
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </SidebarProvider>
    );
}
