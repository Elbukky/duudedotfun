import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(__dirname, "..", "artifacts", "contracts");

// ── Config ──────────────────────────────────────────────────────────────────
const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const PRIVATE_KEY =
  "0xc67461b47038b9b78669c436e3c30013229c9c8c8a0e5a68e1ec16b24c52a480";
const DEFAULT_CLIFF_DAYS = 30;

// ── Existing deployed addresses (unchanged) ─────────────────────────────────
const EXISTING = {
  FeeVault: "0xE51456E01CB44e9B656c5D54BE22bBEC3A0f252B",
  LaunchToken_Impl: "0x65e9Dd20FA6F1643fB0199b69421A61E4e5660b9",
  BondingCurve_Impl: "0x9Dfca88207966a2180c5f59F70bF2eC86793E5Ef",
  VestingVault_Impl: "0xf256b373e17E58EA6E24c30A2975320254a7bBA7",
  PostMigrationPool_Impl: "0xdE73aF09a0DDC32e228Da97e2b60F369b5BA4CE5",
  PostMigrationFactory: "0xE87b516980247b07f01f9BC28d0B605Ab341f9d2",
  TokenFactory_OLD: "0x21c1eD19E091aB31D34Ae1546edef79584773924",
  ArenaRegistry: "0xcFaED45786554bF62870546f47349A1120F66a67",
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function loadArtifact(contractName: string) {
  const path = join(
    artifactsDir,
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const json = JSON.parse(readFileSync(path, "utf8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  duude.fun — TokenFactory UPGRADE (per-token cliffDays)");
  console.log("═══════════════════════════════════════════════════════════");

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`\nDeployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} USDC (native)`);

  // ── Step 1: Deploy new TokenFactory ───────────────────────────────────────
  console.log("\n── Step 1/5: Deploy new TokenFactory ──");
  const { abi: factoryAbi, bytecode: factoryBytecode } =
    loadArtifact("TokenFactory");
  const factoryFactory = new ethers.ContractFactory(
    factoryAbi,
    factoryBytecode,
    wallet
  );
  const newTokenFactory = await factoryFactory.deploy(
    EXISTING.LaunchToken_Impl,
    EXISTING.BondingCurve_Impl,
    EXISTING.VestingVault_Impl,
    EXISTING.PostMigrationFactory,
    EXISTING.FeeVault,
    DEFAULT_CLIFF_DAYS
  );
  const receipt1 = await newTokenFactory.deploymentTransaction()!.wait();
  const newTokenFactoryAddr = await newTokenFactory.getAddress();
  console.log(`  ✓ New TokenFactory deployed at: ${newTokenFactoryAddr}`);
  console.log(`    tx: ${receipt1!.hash}`);
  console.log(`    gas used: ${receipt1!.gasUsed.toString()}`);

  // ── Step 2: FeeVault.authorizeFactory(newTokenFactory) ────────────────────
  console.log("\n── Step 2/5: FeeVault.authorizeFactory(newTokenFactory) ──");
  const { abi: feeVaultAbi } = loadArtifact("FeeVault");
  const feeVault = new ethers.Contract(EXISTING.FeeVault, feeVaultAbi, wallet);
  let tx = await feeVault.authorizeFactory(newTokenFactoryAddr);
  let receipt = await tx.wait();
  console.log(`  ✓ FeeVault authorized new TokenFactory`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Step 3: PostMigrationFactory.setAuthorizedFactory(newTokenFactory) ────
  console.log(
    "\n── Step 3/5: PostMigrationFactory.setAuthorizedFactory(newTokenFactory) ──"
  );
  const { abi: pmfAbi } = loadArtifact("PostMigrationFactory");
  const pmf = new ethers.Contract(
    EXISTING.PostMigrationFactory,
    pmfAbi,
    wallet
  );
  tx = await pmf.setAuthorizedFactory(newTokenFactoryAddr);
  receipt = await tx.wait();
  console.log(`  ✓ PostMigrationFactory authorized new TokenFactory`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Step 4: ArenaRegistry.setFactory(newTokenFactory) ─────────────────────
  console.log("\n── Step 4/5: ArenaRegistry.setFactory(newTokenFactory) ──");
  const { abi: arenaAbi } = loadArtifact("ArenaRegistry");
  const arena = new ethers.Contract(
    EXISTING.ArenaRegistry,
    arenaAbi,
    wallet
  );
  tx = await arena.setFactory(newTokenFactoryAddr);
  receipt = await tx.wait();
  console.log(`  ✓ ArenaRegistry now points to new TokenFactory`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Step 5: TokenFactory.setArenaRegistry(ArenaRegistry) ──────────────────
  console.log(
    "\n── Step 5/5: newTokenFactory.setArenaRegistry(ArenaRegistry) ──"
  );
  const newFactory = new ethers.Contract(
    newTokenFactoryAddr,
    factoryAbi,
    wallet
  );
  tx = await newFactory.setArenaRegistry(EXISTING.ArenaRegistry);
  receipt = await tx.wait();
  console.log(`  ✓ New TokenFactory linked to ArenaRegistry`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const updatedAddresses = {
    FeeVault: EXISTING.FeeVault,
    LaunchToken_Impl: EXISTING.LaunchToken_Impl,
    BondingCurve_Impl: EXISTING.BondingCurve_Impl,
    VestingVault_Impl: EXISTING.VestingVault_Impl,
    PostMigrationPool_Impl: EXISTING.PostMigrationPool_Impl,
    PostMigrationFactory: EXISTING.PostMigrationFactory,
    TokenFactory: newTokenFactoryAddr,
    ArenaRegistry: EXISTING.ArenaRegistry,
  };

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  UPGRADE COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\n  Old TokenFactory: ${EXISTING.TokenFactory_OLD}`);
  console.log(`  New TokenFactory: ${newTokenFactoryAddr}`);
  console.log("\nAll Addresses:");
  for (const [name, addr] of Object.entries(updatedAddresses)) {
    console.log(`  ${name.padEnd(28)} ${addr}`);
  }

  // Save updated deployments.json
  const outputPath = join(__dirname, "..", "deployments.json");
  const output = {
    network: "arc-testnet",
    chainId: CHAIN_ID,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    upgradedAt: new Date().toISOString(),
    upgradeReason: "Added per-token cliffDays to CreateParams",
    addresses: updatedAddresses,
    previousTokenFactory: EXISTING.TokenFactory_OLD,
    feeVaultOwners: [
      wallet.address,
      "0x20262821B19ADf7BC1f61bEd48f5D254898E42B4",
      "0x6159a66fc5cE153Cb003890ec4f07FEfdcc5bE92",
    ],
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nUpdated deployments.json saved.`);

  const finalBalance = await provider.getBalance(wallet.address);
  console.log(
    `\nFinal balance: ${ethers.formatEther(finalBalance)} USDC (native)`
  );
  console.log(
    `Total spent:   ${ethers.formatEther(balance - finalBalance)} USDC`
  );
}

main().catch((err) => {
  console.error("\n✗ Upgrade failed:", err);
  process.exit(1);
});
