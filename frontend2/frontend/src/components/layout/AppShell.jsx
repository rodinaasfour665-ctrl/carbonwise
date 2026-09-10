import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AnimatedBackground from "./AnimatedBackground";

export default function AppShell({ page, onNavigate, connected, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <AnimatedBackground />
      <Sidebar
        page={page}
        connected={connected}
        open={drawerOpen}
        onNavigate={(id) => {
          onNavigate(id);
          setDrawerOpen(false);
        }}
      />
      <div className="main-col">
        <Topbar onMenuToggle={() => setDrawerOpen((v) => !v)} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
