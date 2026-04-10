import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Swords, Rocket, User, Menu, X, BookOpen } from "lucide-react";
import { useState } from "react";

const navItems = [
  { path: "/", label: "Home", icon: Flame },
  { path: "/arena", label: "Arena", icon: Swords },
  { path: "/launch", label: "Launch", icon: Rocket },
  { path: "/docs", label: "Docs", icon: BookOpen },
  { path: "/creator/1", label: "Profile", icon: User },
];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <motion.button
            className="ml-3 relative font-display text-sm px-6 py-2 rounded-xl bg-transparent text-primary border-[3px] border-primary shadow-[0_4px_0_0_hsl(var(--neon-purple)/0.4),0_0_20px_hsl(var(--neon-purple)/0.2)] active:shadow-[0_0_20px_hsl(var(--neon-purple)/0.2)] active:translate-y-[3px] transition-all duration-100 hover:bg-primary/5 hover:shadow-[0_4px_0_0_hsl(var(--neon-purple)/0.5),0_0_30px_hsl(var(--neon-purple)/0.3)]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="absolute inset-[4px] border border-primary/20 rounded-lg pointer-events-none" />
            🔗 Connect Wallet
          </motion.button>
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
          <button className="relative w-full font-display text-sm px-5 py-3 rounded-xl bg-transparent text-primary border-[3px] border-primary shadow-[0_4px_0_0_hsl(var(--neon-purple)/0.4),0_0_20px_hsl(var(--neon-purple)/0.2)] active:shadow-[0_0_20px_hsl(var(--neon-purple)/0.2)] active:translate-y-[3px] transition-all duration-100">
            <span className="absolute inset-[4px] border border-primary/20 rounded-lg pointer-events-none" />
            🔗 Connect Wallet
          </button>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
