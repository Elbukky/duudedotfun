import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/lib/web3Provider";
import { TokenDataProvider } from "@/lib/tokenDataProvider";
import Index from "./pages/Index.tsx";
import LaunchToken from "./pages/LaunchToken.tsx";
import TokenDetail from "./pages/TokenDetail.tsx";
import Arena from "./pages/Arena.tsx";
import CreatorProfile from "./pages/CreatorProfile.tsx";
import Docs from "./pages/Docs.tsx";
import Liquidity from "./pages/Liquidity.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Web3Provider>
      <TokenDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/launch" element={<LaunchToken />} />
              <Route path="/token/:address" element={<TokenDetail />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/liquidity" element={<Liquidity />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/creator/:address" element={<CreatorProfile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TokenDataProvider>
    </Web3Provider>
  </QueryClientProvider>
);

export default App;
