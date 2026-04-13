import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

const EXPLORER = "https://testnet.arcscan.app/address";

const contracts = [
  { name: "TokenFactory", address: "0x21c1eD19E091aB31D34Ae1546edef79584773924" },
  { name: "FeeVault", address: "0xE51456E01CB44e9B656c5D54BE22bBEC3A0f252B" },
  { name: "ArenaRegistry", address: "0xcFaED45786554bF62870546f47349A1120F66a67" },
  { name: "PostMigrationFactory", address: "0xE87b516980247b07f01f9BC28d0B605Ab341f9d2" },
  { name: "BondingCurve (impl)", address: "0x9Dfca88207966a2180c5f59F70bF2eC86793E5Ef" },
  { name: "PostMigrationPool (impl)", address: "0xdE73aF09a0DDC32e228Da97e2b60F369b5BA4CE5" },
  { name: "LaunchToken (impl)", address: "0x65e9Dd20FA6F1643fB0199b69421A61E4e5660b9" },
  { name: "VestingVault (impl)", address: "0xf256b373e17E58EA6E24c30A2975320254a7bBA7" },
];

const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

const Docs = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container pt-24 pb-16 max-w-4xl">
      <motion.h1
        className="text-3xl md:text-4xl font-display text-primary text-glow-purple mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Reference
      </motion.h1>
      <p className="text-muted-foreground font-body mb-10">
        Current features, deployed contracts, and key parameters for{" "}
        <span className="text-primary">duude</span>
        <span className="text-accent">.</span>
        <span className="text-secondary">fun</span> on Arc Testnet.
      </p>

      {/* ── Features ── */}
      <Section title="Features" delay={0.05}>
        <ul className="space-y-1.5 text-sm text-muted-foreground font-body">
          <Li>One-click token launch with bonding curve pricing</Li>
          <Li>Automatic graduation to DEX (Uni V2-style AMM) at 2,500 USDC</Li>
          <Li>Arena battles — 24h ranked competitions for new tokens</Li>
          <Li>On-chain Hype Score (holders, buyers, volume, pressure, retention)</Li>
          <Li>Post-graduation LP management (add/remove liquidity, claim fees)</Li>
          <Li>Beneficiary vesting with 30-day cliff, 365-day linear unlock</Li>
          <Li>Multi-owner protocol fee vault with even split</Li>
          <Li>User profiles with usernames, avatars, and shareable links</Li>
          <Li>Token chat and arena chat with wallet signature verification</Li>
          <Li>Real-time candlestick chart from on-chain events</Li>
          <Li>Top holders list with CURVE / POOL / VESTING / DEV labels</Li>
          <Li>Portfolio view on creator profiles</Li>
        </ul>
      </Section>

      {/* ── Deployed Contracts ── */}
      <Section title="Deployed Contracts" delay={0.1}>
        <p className="text-xs text-muted-foreground font-body mb-3">Arc Testnet (Chain 5042002)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-primary/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-left p-2.5 text-foreground font-display text-xs">Contract</th>
                <th className="text-left p-2.5 text-foreground font-display text-xs">Address</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-body text-xs">
              {contracts.map((c) => (
                <tr key={c.address} className="border-t border-primary/10">
                  <td className="p-2.5 font-medium text-foreground">{c.name}</td>
                  <td className="p-2.5">
                    <a
                      href={`${EXPLORER}/${c.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                    >
                      {shortAddr(c.address)}
                      <ExternalLink size={10} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Key Parameters ── */}
      <Section title="Key Parameters" delay={0.15}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Param label="Token Supply" value="100,000,000,000 (100B)" />
          <Param label="Graduation Target" value="2,500 USDC (net)" />
          <Param label="Virtual USDC (K)" value="300 USDC" />
          <Param label="Virtual Tokens (K)" value="100B tokens" />
          <Param label="Creator Min Buy" value="1 USDC at launch" />
          <Param label="Max Beneficiary Alloc" value="5% (500 bps)" />
          <Param label="Vesting Cliff" value="30 days (default)" />
          <Param label="Vesting Duration" value="365 days linear" />
          <Param label="USDC Decimals (native)" value="18" />
          <Param label="USDC Decimals (ERC-20)" value="6" />
        </div>
      </Section>

      {/* ── Fee Schedule ── */}
      <Section title="Fee Schedule" delay={0.2}>
        <h4 className="text-sm font-display text-foreground mb-2">During Bonding Curve</h4>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm border border-primary/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-left p-2.5 text-foreground font-display text-xs">Recipient</th>
                <th className="text-left p-2.5 text-foreground font-display text-xs">Fee</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-body text-xs">
              <tr className="border-t border-primary/10">
                <td className="p-2.5">Protocol (FeeVault)</td>
                <td className="p-2.5 text-primary font-semibold">0.3%</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-2.5">Creator</td>
                <td className="p-2.5">0% (nothing during bonding)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-sm font-display text-foreground mb-2">After Graduation (DEX Pool)</h4>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm border border-primary/20 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-primary/10">
                <th className="text-left p-2.5 text-foreground font-display text-xs">Recipient</th>
                <th className="text-left p-2.5 text-foreground font-display text-xs">With Active LPs</th>
                <th className="text-left p-2.5 text-foreground font-display text-xs">No Active LPs</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground font-body text-xs">
              <tr className="border-t border-primary/10">
                <td className="p-2.5">Protocol</td>
                <td className="p-2.5 text-primary font-semibold">0.2%</td>
                <td className="p-2.5 text-primary font-semibold">0.2%</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-2.5">Creator</td>
                <td className="p-2.5 text-primary font-semibold">0.1%</td>
                <td className="p-2.5 text-primary font-semibold">0.1%</td>
              </tr>
              <tr className="border-t border-primary/10">
                <td className="p-2.5">LP Providers</td>
                <td className="p-2.5 text-primary font-semibold">0.2%</td>
                <td className="p-2.5">0%</td>
              </tr>
              <tr className="border-t border-primary/10 font-semibold">
                <td className="p-2.5 text-foreground">Total</td>
                <td className="p-2.5 text-primary">0.5%</td>
                <td className="p-2.5 text-primary">0.3%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="text-sm font-display text-foreground mb-2">Arena Score Formula (on-chain)</h4>
        <div className="rounded-xl bg-card/60 border border-primary/10 p-3 font-mono text-xs text-muted-foreground leading-relaxed overflow-x-auto">
          <span className="text-primary">score</span> = (retainedBuyers * 300) + (uniqueBuyers * 100)
          + (buyVolumeUSDC / 1e18) + (buyPressureBps * 10) + (holderCount * 50)
          + (percentCompleteBps * 5)
        </div>
      </Section>
    </div>
  </div>
);

// ── Helpers ──

function Section({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.section
      className="mb-10"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <h2 className="text-lg font-display text-foreground mb-3 border-b border-primary/15 pb-1">{title}</h2>
      {children}
    </motion.section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-primary mt-0.5 text-xs leading-none select-none">*</span>
      <span>{children}</span>
    </li>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/60 border border-primary/10 p-3">
      <p className="text-xs text-muted-foreground font-body">{label}</p>
      <p className="text-sm text-foreground font-display mt-0.5">{value}</p>
    </div>
  );
}

export default Docs;
