import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertProvider } from "@/components/alert-modal";
import AppLayout from "@/components/app-layout";
import Dashboard from "@/pages/dashboard";
import Groups from "@/pages/groups";
import Posts from "@/pages/posts";
import ScannedPosts from "@/pages/scanned-posts";
import Comments from "@/pages/comments";
import SettingsPage from "@/pages/settings";
import FbAccounts from "@/pages/fb-accounts";
import PostHistory from "@/pages/post-history";

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AlertProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fb-accounts" element={<FbAccounts />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/post-history" element={<PostHistory />} />
              <Route path="/scanned-posts" element={<ScannedPosts />} />
              <Route path="/comments" element={<Comments />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AlertProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

