import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bot, BookOpen, FlaskConical, MessagesSquare, QrCode, Menu, PlugZap,
} from "lucide-react";
import { getWhatsappStatus } from "@/lib/api";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard", end: true },
  { to: "/assistentes", label: "Assistentes", icon: Bot, testid: "sidebar-nav-assistentes" },
  { to: "/conhecimento", label: "Base de Conhecimento", icon: BookOpen, testid: "sidebar-nav-conhecimento" },
  { to: "/playground", label: "Playground", icon: FlaskConical, testid: "sidebar-nav-playground" },
  { to: "/conversas", label: "Conversas", icon: MessagesSquare, testid: "sidebar-nav-conversas" },
  { to: "/whatsapp", label: "Canal WhatsApp", icon: QrCode, testid: "sidebar-nav-whatsapp" },
];

const STATUS_MAP = {
  connected: { label: "WhatsApp conectado", dot: "bg-success", text: "text-success" },
  connecting: { label: "WhatsApp conectando", dot: "bg-info", text: "text-info" },
  disconnected: { label: "WhatsApp desconectado", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

const SidebarContent = ({ waStatus, onNavigate }) => {
  const st = STATUS_MAP[waStatus] || STATUS_MAP.disconnected;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessagesSquare className="h-5 w-5" />
        </div>
        <div>
          <div className="font-heading text-base font-semibold leading-tight">AtendeAI</div>
          <div className="text-xs text-muted-foreground">Console de Atendimento</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={item.testid}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2 text-xs" data-testid="sidebar-whatsapp-status">
          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
          <span className={st.text}>{st.label}</span>
        </div>
      </div>
    </div>
  );
};

export const AppShell = ({ children }) => {
  const [waStatus, setWaStatus] = useState("disconnected");
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const load = () => getWhatsappStatus().then((s) => active && setWaStatus(s.status)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-[260px] shrink-0 border-r bg-card md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent waStatus={waStatus} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="mobile-menu-button">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] p-0">
              <SidebarContent waStatus={waStatus} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PlugZap className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">AtendeAI Console</span>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
};
