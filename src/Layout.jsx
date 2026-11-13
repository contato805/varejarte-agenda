import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, LayoutDashboard, FileText, LogOut, Shield, Eye, Settings, Users, Building2, Tag, Sun, Moon, ChevronLeft, History, Download } from "lucide-react";

import MobileNav from "./components/layout/MobileNav";
import DataReadBoundary from "./components/layout/DataReadBoundary";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

// Nav items by access level (sem Nova Entrada e sem gerenciamento)
const ADMIN_NAV = [
{ name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
{ name: "Agenda", page: "Agenda", icon: Calendar },
{ name: "Relatórios", page: "Reports", icon: FileText }];


const VIEWER_NAV = [
{ name: "Agenda", page: "Agenda", icon: Calendar }];


export default function Layout({ children, currentPageName }) {
  const { user: employeeSession, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isEmployeeAdmin = employeeSession?.access_type === "admin";
  const isFullAdmin = isEmployeeAdmin;

  const ROOT_PAGES = ["Dashboard", "Agenda", "Reports"];
  const isChildRoute = !ROOT_PAGES.includes(currentPageName) && currentPageName !== "entrar";

  const navItems = isFullAdmin ? ADMIN_NAV : VIEWER_NAV;

  const handleLogout = async () => {
    try { await logout(); }
    finally { navigate("/entrar", { replace: true }); }
  };

  if (currentPageName === "entrar") return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <nav
        className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Back button */}
            <div className="flex items-center gap-2">
              {isChildRoute &&
              <button
                onClick={() => {
                  if (window.history.length > 2) {
                    navigate(-1);
                  } else {
                    navigate(createPageUrl("Dashboard"));
                  }
                }}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                
                  <ChevronLeft className="w-5 h-5" />
                </button>
              }
              <img src="/brand/varejarte.png"
              alt="Varejarte" className="py-8 h-28 w-auto object-contain" />
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive ?
                      "bg-primary text-primary-foreground shadow-md shadow-primary/20" :
                      "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}>
                    
                    <Icon className="mx-2 lucide lucide-layout-dashboard w-4 h-4" />
                    <span className="hidden md:inline">{item.name}</span>
                  </Link>);

              })}
            </div>

            {/* Right side: settings gear + user + logout */}
            <div className="flex items-center gap-2">
              {/* User badge */}
              {employeeSession &&
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent/50 text-xs">
                  <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: employeeSession?.color || "hsl(var(--primary))" }}>
                    {(employeeSession?.name || "U")?.charAt(0)}
                  </div>
                  <span className="font-medium text-foreground truncate max-w-[100px]">
                    {employeeSession?.name || "Usuário"}
                  </span>
                  {isEmployeeAdmin ?
                <Shield className="w-3 h-3 text-primary shrink-0" /> :
                <Eye className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
              }

              {/* Settings dropdown — admin only */}
              {isFullAdmin &&
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Configurações">
                    
                      <Settings className="w-8 h-8 text-primary" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Gerenciamento</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Employees")} className="flex items-center gap-2 cursor-pointer">
                        <Users className="w-4 h-4 text-primary" />
                        Colaboradores
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("Clients")} className="flex items-center gap-2 cursor-pointer">
                        <Building2 className="w-4 h-4 text-primary" />
                        Clientes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("ActivityTypes")} className="flex items-center gap-2 cursor-pointer">
                        <Tag className="w-4 h-4 text-primary" />
                        Atividades
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl("AuditHistory")} className="flex items-center gap-2 cursor-pointer">
                        <History className="w-4 h-4 text-primary" />
                        Histórico
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/Settings" className="flex items-center gap-2 cursor-pointer">
                        <Download className="w-4 h-4 text-primary" />
                        Backup / Exportar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex items-center gap-2 cursor-pointer">
                      {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                      {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }

              {/* Logout for viewers (no settings dropdown) */}
              {!isFullAdmin &&
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Sair">
                
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              }
            </div>
          </div>
        </div>
      </nav>

      <main
        className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 md:pb-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}>
        
        <DataReadBoundary>{children}</DataReadBoundary>
      </main>

      <MobileNav currentPageName={currentPageName} isFullAdmin={isFullAdmin} />

    </div>);

}
