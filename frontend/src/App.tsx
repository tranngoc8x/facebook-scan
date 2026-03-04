import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/app-layout";
import Dashboard from "@/pages/dashboard";
import Groups from "@/pages/groups";
import Rooms from "@/pages/rooms";
import Posts from "@/pages/posts";
import Comments from "@/pages/comments";
import SettingsPage from "@/pages/settings";
import FbAccounts from "@/pages/fb-accounts";

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fb-accounts" element={<FbAccounts />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/comments" element={<Comments />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  );
}
