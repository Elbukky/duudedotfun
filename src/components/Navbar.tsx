import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Swords, Rocket, User, Menu, X, BookOpen, LogOut } from "lucide-react";
import { useState } from "react";
import { useWeb3 } from "@/lib/web3Provider";
import { shortAddress } from "@/lib/arcscan";

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address, isConnected, isConnecting, connect, disconnect } = useWeb3();

  const navItems = [
    { path: "/", label: "Home", icon: Flame },
    { path: "/arena", label: "Arena", icon: Swords },
    { path: "/launch", label: "Launch", icon: Rocket },
    { path: "/docs", label: "Docs", icon: BookOpen },
    ...(isConnected && address
      ? [{ path: `/creator/${address}`, label: "Profile", icon: User }]
      : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b-2 border-primary/20 bg-background/90 backdrop-blur-md">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <motion.span
            className="text-2xl font-display tracking-wider"
            whileHover={{ scale: 1.05 }}
            style={{
              background: 'linear-gradient(90deg, hsl(var(--neon-purple)), hsl(var(--slime-green)), hsl(var(--gold)))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              WebkitTextStroke: '1.5px transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px hsl(var(--neon-purple) / 0.3))',
            }}
          >
            duude.fun
          </motion.span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}>
                <motion.div
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-body font-semibold text-sm transition-colors ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon size={16} />
                  {label}
                </motion.div>
              </Link>
            );
          })}

          {isConnected ? (
            <div className="ml-3 flex items-center gap-2">
              <span className="font-body text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-xl border border-primary/20">
                {shortAddress(address!)}
              </span>
              <motion.button
                onClick={disconnect}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="Disconnect"
              >
                <LogOut size={14} />
              </motion.button>
            </div>
          ) : (
            <motion.button
              onClick={connect}
              disabled={isConnecting}
              className="ml-3 font-display text-xs px-4 py-1.5 rounded-xl bg-primary text-primary-foreground border-2 border-primary border-b-[4px] border-b-primary/60 active:border-b-2 active:translate-y-[2px] transition-all duration-100 shadow-[0_3px_0_hsl(var(--neon-purple)/0.5)] active:shadow-none hover:brightness-110 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </motion.button>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t border-primary/20 bg-background/95 backdrop-blur-md p-4 space-y-2"
        >
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path} onClick={() => setMobileOpen(false)}>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-primary/10 font-body font-semibold">
                <Icon size={18} />
                {label}
              </div>
            </Link>
          ))}
          {isConnected ? (
            <div className="flex items-center justify-between px-4 py-2">
              <span className="font-body text-xs text-muted-foreground">{shortAddress(address!)}</span>
              <button onClick={disconnect} className="text-xs text-destructive font-body">Disconnect</button>
            </div>
          ) : (
            <button
              onClick={() => { connect(); setMobileOpen(false); }}
              disabled={isConnecting}
              className="w-full font-display text-xs px-4 py-2.5 rounded-xl bg-primary text-primary-foreground border-2 border-primary border-b-[4px] border-b-primary/60 active:border-b-2 active:translate-y-[2px] transition-all duration-100 shadow-[0_3px_0_hsl(var(--neon-purple)/0.5)] active:shadow-none disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
