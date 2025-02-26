'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import AnimatedSidebarButton from "@/components/animated-sidebar-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      name: "Files",
      href: "/dashboard/files",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z" />
          <path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8" />
          <path d="M15 2v5h5" />
        </svg>
      ),
    },
  ];

  const chatNavigation = [
    {
      name: "Chat",
      href: "/dashboard/chat",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
      ),
      subItems: [
        {
          name: "New Chat",
          href: "/dashboard/chat",
        },
        {
          name: "Chat History",
          href: "/dashboard/chat/history",
        },
      ],
    },
  ];

  const settingsNavigation = [
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  // Check if we're on the chat page
  const isChatPage = pathname.includes('/dashboard/chat');

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0 lg:w-16"
          } fixed inset-y-0 z-10 flex flex-col border-r bg-background transition-all duration-300 ease-in-out lg:relative lg:translate-x-0`}
        >
          <div className={`border-b px-4 py-4 ${!sidebarOpen && "lg:justify-center"} flex items-center relative`}>
            <div className={`flex items-center gap-2 ${!sidebarOpen && "lg:hidden"}`}>
              <div className="flex-1 flex items-center justify-between">
                <Link
                  href="/dashboard"
                  className="text-xl font-bold tracking-tight"
                >
                  PDVerse
                </Link>
              </div>
            </div>
            {/* No logo for collapsed sidebar */}
            <div className={`${sidebarOpen ? "lg:hidden" : "hidden"} hidden`}>
              <h1 className="text-lg font-semibold">PD</h1>
            </div>
          </div>
          <div className={`flex-1 overflow-auto py-2 ${!sidebarOpen && "lg:hidden"}`}>
            <nav className="grid items-start px-2 text-sm font-medium">
              <div className="px-2 py-2 text-xs font-semibold tracking-wide text-muted-foreground">
                NAVIGATION
              </div>
              <div className="grid gap-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground ${
                      pathname === item.href ? "bg-muted text-foreground" : ""
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="space-y-1 mt-4">
                {chatNavigation.map((item) => (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground ${
                        pathname === item.href ? "bg-muted text-foreground" : ""
                      }`}
                    >
                      {item.icon}
                      {item.name}
                    </Link>
                    {item.subItems && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className={`block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground ${
                              pathname === subItem.href
                                ? "bg-muted text-foreground"
                                : ""
                            }`}
                          >
                            {subItem.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1">
                {settingsNavigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground ${
                      pathname === item.href ? "bg-muted text-foreground" : ""
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
          {/* Collapsed sidebar navigation (only icons) */}
          <div className={`${sidebarOpen && "lg:hidden"} hidden lg:flex flex-col items-center py-4`}>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg text-muted-foreground transition-all hover:text-foreground ${
                  pathname === item.href ? "bg-muted text-foreground" : ""
                }`}
                title={item.name}
              >
                {item.icon}
              </Link>
            ))}
            
            {/* Chat navigation in collapsed mode */}
            {chatNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg text-muted-foreground transition-all hover:text-foreground ${
                  pathname.startsWith(item.href) ? "bg-muted text-foreground" : ""
                }`}
                title={item.name}
              >
                {item.icon}
              </Link>
            ))}
            
            {/* Settings navigation in collapsed mode */}
            {settingsNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-center w-10 h-10 my-1 rounded-lg text-muted-foreground transition-all hover:text-foreground ${
                  pathname === item.href ? "bg-muted text-foreground" : ""
                }`}
                title={item.name}
              >
                {item.icon}
              </Link>
            ))}
          </div>
          {/* User section in sidebar */}
          <div className={`${!sidebarOpen && "lg:hidden"} mt-auto border-t p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted"></div>
                <div>
                  <div className="font-medium">John Doe</div>
                  <span className="text-xs text-muted-foreground">john@example.com</span>
                </div>
              </div>
              {/* Add theme toggle in desktop user section */}
              <ThemeToggle />
            </div>
          </div>
          {/* User section - collapsed sidebar */}
          <div className={`${sidebarOpen && "lg:hidden"} hidden lg:flex flex-col border-t p-4 items-center justify-center gap-4`}>
            <div className="h-8 w-8 rounded-full bg-muted" title="John Doe"></div>
            <ThemeToggle />
          </div>
        </aside>
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:hidden">
            <AnimatedSidebarButton
              isOpen={sidebarOpen}
              onClick={toggleSidebar}
              className="lg:hidden"
            />
            <div className="flex-1 flex items-center justify-between">
              <Link
                href="/dashboard"
                className="text-lg font-semibold tracking-tight"
              >
                PDVerse
              </Link>
              <ThemeToggle />
            </div>
          </header>
          <main className={`flex-1 overflow-hidden ${isChatPage ? 'p-0' : 'p-4 lg:p-6'}`}>
            {/* Sidebar toggle button - always visible on desktop */}
            <div className={`${isChatPage ? 'p-4 pt-4' : 'mb-4'} hidden lg:flex`}>
              <AnimatedSidebarButton
                isOpen={sidebarOpen}
                onClick={toggleSidebar}
                className="hidden lg:flex"
              />
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
