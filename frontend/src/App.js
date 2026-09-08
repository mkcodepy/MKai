import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import Assistants from "@/pages/Assistants";
import AssistantEditor from "@/pages/AssistantEditor";
import KnowledgeBase from "@/pages/KnowledgeBase";
import Playground from "@/pages/Playground";
import Conversations from "@/pages/Conversations";
import WhatsAppChannel from "@/pages/WhatsAppChannel";

function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assistentes" element={<Assistants />} />
          <Route path="/assistentes/novo" element={<AssistantEditor />} />
          <Route path="/assistentes/:id" element={<AssistantEditor />} />
          <Route path="/conhecimento" element={<KnowledgeBase />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/conversas" element={<Conversations />} />
          <Route path="/whatsapp" element={<WhatsAppChannel />} />
        </Routes>
      </AppShell>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;
