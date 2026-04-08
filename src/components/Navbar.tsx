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
            className="text-2xl font-display text-primary text-glow-purple"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-foreground">du</span><span className="text-primary">ude</span><span className="text-accent">.</span><span className="text-secondary">fun</span>
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
            className="ml-3 btn-arcade bg-primary text-primary-foreground px-5 py-2 text-sm border-primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Connect Wallet
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
          <button className="w-full btn-arcade bg-primary text-primary-foreground px-5 py-3 text-sm border-primary font-body">
            Connect Wallet
          </button>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
