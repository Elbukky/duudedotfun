import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { BookOpen, Zap, Coins, ChevronDown, DollarSign } from "lucide-react";
import { useState } from "react";

const sections = [
  {
    icon: BookOpen,
    title: "Getting Started",
    desc: "Launch your first memecoin on duude.fun in under 5 minutes.",
    content: (
      <>
        <h3 className="text-xl font-display text-primary mb-3">Launch Your First Memecoin on duude.fun in 5 Minutes</h3>
        <p className="text-muted-foreground font-body mb-4">
          duude.fun lets anyone launch a memecoin quickly without needing to code or set up liquidity manually. The platform is designed to make launching simple, fun, and competitive from day one.
        </p>
        <p className="text-muted-foreground font-body mb-4">
          To get started, a user only needs a supported wallet, enough funds for gas and launch fees, and basic token details like a name, ticker, logo, and short meme description.
        </p>
        <h4 className="text-lg font-display text-foreground mb-2">The Launch Process</h4>
        <ol className="list-decimal list-inside text-muted-foreground font-body space-y-1 mb-4">
          <li>Connect wallet</li>
          <li>Click "Launch a Coin"</li>
          <li>Fill in token details</li>
          <li>Review launch preview</li>
          <li>Confirm launch</li>
        </ol>
        <p className="text-muted-foreground font-body mb-3">Once the transaction is confirmed, duude.fun automatically:</p>
        <ul className="list-none text-muted-foreground font-body space-y-1 mb-4">
          <li>✅ Deploys the token</li>
          <li>✅ Creates its launch market</li>
          <li>✅ Makes it instantly tradable</li>
          <li>✅ Generates a token page</li>
          <li>✅ Enters it into the Rookie Arena</li>
        </ul>
        <p className="text-muted-foreground font-body">
          From there, the token can begin gaining traction through trading, community activity, and Arena performance.
        </p>
      </>
    ),
  },
  {
    icon: Zap,
    title: "Arena Battles",
    desc: "How tokens compete, earn Hype Score, and climb the leaderboard.",
    content: (
      <>
        <p className="text-muted-foreground font-body mb-4">
          Once your token is live, it is automatically entered into the <span className="text-primary font-semibold">Rookie Arena</span> — a 24-hour battle where new memecoins compete for attention, traction, and visibility.
        </p>
        <p className="text-muted-foreground font-body mb-4">
          The Arena is designed to help strong launches stand out. During this phase, tokens are ranked based on a <span className="text-primary font-semibold">Hype Score</span>, which is calculated using key performance signals such as:
        </p>
        <ul className="list-none text-muted-foreground font-body space-y-1 mb-4">
          <li>🔥 Unique buyers</li>
          <li>🔥 Buy volume</li>
          <li>🔥 Holder retention</li>
          <li>🔥 Buy vs sell pressure</li>
          <li>🔥 Mission completion</li>
        </ul>
        <p className="text-muted-foreground font-body mb-4">
          This means tokens do not win simply because of one big buy — they perform better when they attract real community participation and maintain momentum.
        </p>
        <p className="text-muted-foreground font-body mb-4">
          As the token competes, it can also complete missions like reaching a holder milestone, hitting trading volume targets, or surviving for a certain amount of time. These missions help improve its Arena standing and make the launch more engaging for the community.
        </p>
        <h4 className="text-lg font-display text-foreground mb-2">Arena Rewards</h4>
        <p className="text-muted-foreground font-body mb-3">At the end of the Arena period, the best-performing tokens earn rewards such as:</p>
        <ul className="list-none text-muted-foreground font-body space-y-1 mb-4">
          <li>🏆 Front page visibility</li>
          <li>🏆 Winner badges</li>
          <li>🏆 Discovery boosts</li>
          <li>🏆 Creator revenue boosts</li>
          <li>🏆 Progress toward graduation</li>
        </ul>
        <p className="text-muted-foreground font-body">
          If a token does not perform well, it is not removed or punished — it simply misses out on the extra benefits. It remains tradable and can still continue growing after the Arena.
        </p>
      </>
    ),
  },
  {
    icon: Coins,
    title: "Tokenomics",
    desc: "Understand bonding curves, token distribution, and how pricing works.",
    content: (
      <>
        <p className="text-muted-foreground font-body mb-4">
          Every token launched on duude.fun follows a fixed token distribution model to keep launches simple, fair, and consistent across the platform.
        </p>
        <h4 className="text-lg font-display text-foreground mb-2">Token Distribution (1 Billion Total Supply)</h4>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center">
            <p className="text-2xl font-display text-primary">85%</p>
            <p className="text-sm text-muted-foreground font-body">Bonding Curve / Launch Market</p>
          </div>
          <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 text-center">
            <p className="text-2xl font-display text-accent">5%</p>
            <p className="text-sm text-muted-foreground font-body">Creator Allocation</p>
          </div>
          <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-4 text-center">
            <p className="text-2xl font-display text-secondary">10%</p>
            <p className="text-sm text-muted-foreground font-body">Reserve Allocation</p>
          </div>
        </div>
        <p className="text-muted-foreground font-body mb-4">
          The <strong className="text-foreground">85% market allocation</strong> is the main supply available for public buying and selling once the token goes live. This powers the launch market and allows trading to begin immediately.
        </p>
        <p className="text-muted-foreground font-body mb-4">
          The <strong className="text-foreground">5% creator allocation</strong> gives the token creator a stake in the project, but it is not unlocked immediately. To reduce abuse and prevent instant dumping, the creator allocation is locked for the first 24 hours and then released gradually over 14 days.
        </p>
        <p className="text-muted-foreground font-body mb-4">
          The <strong className="text-foreground">10% reserve allocation</strong> is set aside to support the token's lifecycle and platform mechanics. It can be used for:
        </p>
        <ul className="list-none text-muted-foreground font-body space-y-1 mb-4">
          <li>📦 Graduation / liquidity support</li>
          <li>📦 Arena-related reward mechanics</li>
          <li>📦 Platform reserve or treasury needs</li>
        </ul>
        <h4 className="text-lg font-display text-foreground mb-2">Bonding Curve Pricing</h4>
        <p className="text-muted-foreground font-body mb-3">
          duude.fun uses a bonding curve pricing model, which means the token price is not fixed. Instead:
        </p>
        <ul className="list-none text-muted-foreground font-body space-y-1 mb-4">
          <li>📈 When users buy, the price goes up</li>
          <li>📉 When users sell, the price goes down</li>
        </ul>
        <p className="text-muted-foreground font-body mb-4">
          This creates an active market from launch and gives early buyers an advantage as demand increases.
        </p>
        <p className="text-muted-foreground font-body">
          In short, duude.fun tokenomics are designed to make every launch <span className="text-primary">easy to understand</span>, <span className="text-primary">fairer for traders</span>, <span className="text-primary">healthier for creators</span>, and <span className="text-primary">exciting from day one</span>.
        </p>
      </>
    ),
  },
  {
    icon: DollarSign,
    title: "Fees & Creator Rewards",
    desc: "Transparent fees, token allocations, and how creators earn.",
    content: (
      <>
        <p className="text-muted-foreground font-body mb-4">
          duude.fun uses transparent fees and token allocations to reward creators, fund the platform, and incentivize Arena participation.
        </p>

        <h4 className="text-lg font-display text-foreground mb-2">1) Launch Fee</h4>
        <p className="text-muted-foreground font-body mb-1">
          <span className="text-primary font-semibold">$2 per token launch</span> → platform only
        </p>
        <p className="text-muted-foreground font-body mb-6">
          Covers operational costs, hosting, and early Arena reward pool funding.
        </p>

        <h4 className="text-lg font-display text-foreground mb-3">2) Trading Fees (0.3% per trade)</h4>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border border-primary/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-left p-3 text-foreground font-display">Allocation</th>
                <th className="text-left p-3 text-foreground font-display">% of Trade</th>
                <th className="text-left p-3 text-foreground font-display">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-body">
              <tr className="border-t border-primary/10">
                <td className="p-3">Creator reward</td>
                <td className="p-3 text-primary font-semibold">0.05%</td>
                <td className="p-3">Ongoing passive income for token creators</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-3">Arena reward pool</td>
                <td className="p-3 text-primary font-semibold">0.05%</td>
                <td className="p-3">Rewards top tokens and active holders during Arena</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-3">Platform revenue</td>
                <td className="p-3 text-primary font-semibold">0.20%</td>
                <td className="p-3">Covers platform operations and maintenance</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-lg font-display text-foreground mb-3">3) Token Allocation (1B total)</h4>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border border-primary/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-left p-3 text-foreground font-display">Allocation</th>
                <th className="text-left p-3 text-foreground font-display">% of Total</th>
                <th className="text-left p-3 text-foreground font-display">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-body">
              <tr className="border-t border-primary/10">
                <td className="p-3">Bonding curve / Public market</td>
                <td className="p-3 text-primary font-semibold">85%</td>
                <td className="p-3">Tradable market supply; powers price discovery</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-3">Creator allocation</td>
                <td className="p-3 text-primary font-semibold">5%</td>
                <td className="p-3">Locked 24h → linear vesting over 14 days; optional Arena bonus for winners</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-3">Reserve allocation</td>
                <td className="p-3 text-primary font-semibold">10%</td>
                <td className="p-3">Supports token lifecycle and platform mechanics</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-lg font-display text-foreground mb-3">Reserve Breakdown (10%)</h4>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border border-primary/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-left p-3 text-foreground font-display">Use</th>
                <th className="text-left p-3 text-foreground font-display">% of Total Supply</th>
                <th className="text-left p-3 text-foreground font-display">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-body">
              <tr className="border-t border-primary/10">
                <td className="p-3">Arena reward reserve</td>
                <td className="p-3 text-primary font-semibold">3%</td>
                <td className="p-3">Extra rewards for top tokens and engaged holders</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-3">Liquidity / Graduation reserve</td>
                <td className="p-3 text-primary font-semibold">5%</td>
                <td className="p-3">Ensures liquidity and smooth token graduation</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-3">Platform / Treasury buffer</td>
                <td className="p-3 text-primary font-semibold">2%</td>
                <td className="p-3">Operational safety and ecosystem incentives</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-lg font-display text-foreground mb-3">Summary</h4>
        <ul className="list-none text-muted-foreground font-body space-y-2 mb-4">
          <li>💰 <strong className="text-foreground">Launch Fee:</strong> $2 → platform</li>
          <li>💰 <strong className="text-foreground">Trading Fee:</strong> 0.3% → 0.05% creator / 0.05% Arena pool / 0.20% platform</li>
          <li>💰 <strong className="text-foreground">Token Supply:</strong> 85% public / 5% creator (vesting) / 10% reserve (3% Arena, 5% liquidity, 2% platform)</li>
        </ul>
        <p className="text-muted-foreground font-body">
          This design aligns incentives for creators, rewards performance in the Arena, ensures community engagement, and keeps the platform sustainable.
        </p>
      </>
    ),
  },
];

const DocsSection = ({ icon: Icon, title, desc, content, index }: {
  icon: React.ElementType; title: string; desc: string; content: React.ReactNode; index: number;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      className="card-arcade rounded-2xl border-2 border-primary/20 bg-card/80 backdrop-blur-sm hover:border-primary/50 transition-colors overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20">
            <Icon className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-display text-foreground">{title}</h2>
            <p className="text-muted-foreground font-body text-sm">{desc}</p>
          </div>
        </div>
        <ChevronDown className={`text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} size={20} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-6 border-t border-primary/10 pt-4">
          {content}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Docs = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container pt-24 pb-16">
      <motion.h1
        className="text-4xl md:text-5xl font-display text-primary text-glow-purple mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        📚 Documentation
      </motion.h1>
      <p className="text-muted-foreground font-body text-lg mb-12 max-w-2xl">
        Everything you need to know about launching, trading, and battling memecoins on <span className="text-primary">duude</span><span className="text-accent">.</span><span className="text-secondary">fun</span>.
      </p>

      <div className="flex flex-col gap-4 max-w-4xl">
        {sections.map((section, i) => (
          <DocsSection key={section.title} {...section} index={i} />
        ))}
      </div>
    </div>
  </div>
);

export default Docs;
