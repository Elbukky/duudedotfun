import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { Upload, Sparkles, Twitter, Globe, MessageCircle, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useWeb3 } from "@/lib/web3Provider";
import { useTokenFactory } from "@/hooks/useTokenFactory";
import { ethers } from "ethers";
import { toast } from "sonner";
import { categories } from "@/lib/mockData";

const LaunchToken = () => {
  const navigate = useNavigate();
  const { isConnected, connect } = useWeb3();
  const { createToken, creating } = useTokenFactory();

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Degen');
  const [initialBuyAmount, setInitialBuyAmount] = useState('1');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [discord, setDiscord] = useState('');
  const [website, setWebsite] = useState('');

  // Mock image upload (stored locally until R2 integration)
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLaunch = async () => {
    if (!isConnected) {
      connect();
      return;
    }

    if (!name.trim()) { toast.error("Token name is required"); return; }
    if (!ticker.trim()) { toast.error("Ticker is required"); return; }
    if (ticker.length > 8) { toast.error("Ticker must be 8 chars or less"); return; }
    const buyAmount = parseFloat(initialBuyAmount);
    if (isNaN(buyAmount) || buyAmount < 1) {
      toast.error("Initial buy must be at least 1 USDC");
      return;
    }

    try {
      // Don't pass the full base64 image to the contract — it's too large.
      // Store image locally in localStorage, pass empty string on-chain.
      // Will be replaced with R2 upload later.
      const imageURI = "";

      const result = await createToken(
        {
          name: name.trim(),
          symbol: ticker.trim(),
          description: description.trim(),
          imageURI,
          links: {
            website: website.trim(),
            twitter: twitter.trim(),
            telegram: telegram.trim(),
            discord: discord.trim(),
            extra: category,
          },
          beneficiaries: [],
          bpsAllocations: [],
          referrer: ethers.ZeroAddress,
        },
        initialBuyAmount
      );

      // Save the image to localStorage keyed by the token address
      if (result.tokenAddress && imagePreview) {
        localStorage.setItem(`token-image-${result.tokenAddress.toLowerCase()}`, imagePreview);
      }

      toast.success(`Token $${ticker} launched!`);
      if (result.tokenAddress) {
        navigate(`/token/${result.tokenAddress}`);
      }
    } catch (err: any) {
      console.error("Launch failed:", err);
      const msg = err?.reason || err?.message || "Transaction failed";
      toast.error(msg.length > 100 ? msg.slice(0, 100) + "..." : msg);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-display text-foreground text-center mb-2">
              CREATE YOUR <span className="text-primary text-glow-purple">FIGHTER</span>
            </h1>
            <p className="text-center text-muted-foreground font-body mb-8">Your token will enter today's arena battle.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <motion.div className="space-y-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <div className="card-cartoon space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Token Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="PepeFighter" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Ticker</label>
                  <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="PEPEF" maxLength={8} className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Meme Lore</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell the world about your meme..." rows={3} className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Logo</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    {imagePreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={imagePreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover" />
                        <p className="text-xs text-muted-foreground font-body">Click to change</p>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground font-body">Click to upload logo (max 5MB)</p>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-2 block">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.filter(c => c !== 'All').map((c) => (
                      <motion.button key={c} onClick={() => setCategory(c)} className={`badge-sticker text-xs cursor-pointer ${category === c ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-muted"}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        {c}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Initial Buy */}
              <div className="card-cartoon space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm text-foreground">Initial Buy (USDC)</h3>
                  <span className="badge-sticker text-[10px] bg-accent/10 text-accent border-accent/30">MIN 1 USDC</span>
                </div>
                <input type="number" value={initialBuyAmount} onChange={(e) => setInitialBuyAmount(e.target.value)} min="1" step="0.1" placeholder="1" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-3 text-foreground font-body focus:outline-none focus:border-primary/50 transition-colors" />
                <div className="flex gap-2">
                  {['1', '5', '10', '25'].map((v) => (
                    <motion.button key={v} onClick={() => setInitialBuyAmount(v)} className={`flex-1 py-2 rounded-lg border text-xs font-body transition-colors ${initialBuyAmount === v ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-primary/20 hover:border-primary/40"}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      {v} USDC
                    </motion.button>
                  ))}
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <AlertCircle size={14} className="text-accent shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground font-body">You'll be the first buyer. This USDC goes into the bonding curve.</p>
                </div>
              </div>

              {/* Social Links */}
              <div className="card-cartoon space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm text-foreground">SOCIAL LINKS</h3>
                  <span className="badge-sticker text-[10px] bg-muted text-muted-foreground border-muted">OPTIONAL</span>
                </div>
                <div className="flex items-center gap-3">
                  <Twitter size={16} className="text-muted-foreground shrink-0" />
                  <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/yourtoken" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-2.5 text-foreground font-body text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div className="flex items-center gap-3">
                  <MessageCircle size={16} className="text-muted-foreground shrink-0" />
                  <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/yourgroup" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-2.5 text-foreground font-body text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div className="flex items-center gap-3">
                  <MessageCircle size={16} className="text-muted-foreground shrink-0" />
                  <input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/yourinvite" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-2.5 text-foreground font-body text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div className="flex items-center gap-3">
                  <Globe size={16} className="text-muted-foreground shrink-0" />
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourtoken.com" className="w-full bg-muted border-2 border-primary/20 rounded-xl px-4 py-2.5 text-foreground font-body text-sm focus:outline-none focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <motion.button onClick={handleLaunch} disabled={creating} className="w-full btn-arcade bg-primary text-primary-foreground border-primary py-4 text-sm flex items-center justify-center gap-2 disabled:opacity-50" whileHover={{ scale: creating ? 1 : 1.02 }} whileTap={{ scale: creating ? 1 : 0.98 }}>
                {creating ? (
                  <><Loader2 size={18} className="animate-spin" /> LAUNCHING...</>
                ) : !isConnected ? (
                  "CONNECT WALLET TO LAUNCH"
                ) : (
                  <><Sparkles size={18} /> LAUNCH TOKEN ({initialBuyAmount} USDC)</>
                )}
              </motion.button>
            </motion.div>

            {/* Live Preview */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="card-cartoon glow-purple sticky top-24">
                <h3 className="font-display text-xs text-muted-foreground text-center mb-4">BATTLE CARD PREVIEW</h3>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-muted border-2 border-primary/30 mx-auto flex items-center justify-center mb-3 overflow-hidden">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Token" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">?</span>
                    )}
                  </div>
                  <h4 className="font-display text-lg text-foreground">{name || 'Your Token'}</h4>
                  <p className="font-display text-sm text-primary">${ticker || 'TICKER'}</p>
                  <p className="text-xs text-muted-foreground font-body mt-2 max-w-xs mx-auto">{description || 'Your meme lore will appear here...'}</p>
                  <div className="mt-4 flex justify-center gap-2">
                    <span className="badge-sticker text-[10px] bg-primary/20 text-primary border-primary/40">{category}</span>
                    <span className="badge-sticker text-[10px] bg-accent/20 text-accent border-accent/40">NEW</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Initial Buy</span>
                      <span className="text-accent">{initialBuyAmount} USDC</span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Supply</span>
                      <span className="text-foreground">100B tokens</span>
                    </div>
                    <div className="flex justify-between text-xs font-body">
                      <span className="text-muted-foreground">Graduation</span>
                      <span className="text-secondary">1,500 USDC</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchToken;
