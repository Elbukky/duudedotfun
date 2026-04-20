import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { Analytics } from "@vercel/analytics/react";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/lib/web3Provider";
import { TokenDataProvider } from "@/lib/tokenDataProvider";
import { ProfileProvider } from "@/lib/profileProvider";
import Index from "./pages/Index.tsx";
import LaunchToken from "./pages/LaunchToken.tsx";
import TokenDetail from "./pages/TokenDetail.tsx";
import Arena from "./pages/Arena.tsx";
import CreatorProfile from "./pages/CreatorProfile.tsx";
import UserProfilePage from "./pages/UserProfile.tsx";
import Docs from "./pages/Docs.tsx";
import Explore from "./pages/Explore.tsx";
import Liquidity from "./pages/Liquidity.tsx";
import Tasks from "./pages/Tasks.tsx";
import NotFound from "./pages/NotFound.tsx";


const queryClient = new QueryClient();

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: "hsl(270 80% 60%)", // --neon-purple
          accentColorForeground: "white",
          borderRadius: "large",
          fontStack: "system",
        })}
      >
        <Web3Provider>
          <TokenDataProvider>
            <ProfileProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/launch" element={<LaunchToken />} />
                    <Route path="/token/:address" element={<TokenDetail />} />
                    <Route path="/arena" element={<Arena />} />
                    <Route path="/liquidity" element={<Liquidity />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/docs" element={<Docs />} />
                    <Route path="/creator/:address" element={<CreatorProfile />} />
                    <Route path="/u/:username" element={<UserProfilePage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
                <Analytics />
              </TooltipProvider>
            </ProfileProvider>
          </TokenDataProvider>
        </Web3Provider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
