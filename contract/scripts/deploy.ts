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
const BATTLE_DURATION = 86400; // 24 hours in seconds

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

async function deployContract(
  wallet: ethers.Wallet,
  contractName: string,
  args: any[] = [],
  label?: string
): Promise<ethers.Contract> {
  const tag = label || contractName;
  console.log(`\nDeploying ${tag}...`);

  const { abi, bytecode } = loadArtifact(contractName);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  const contract = await factory.deploy(...args);
  const receipt = await contract.deploymentTransaction()!.wait();

  console.log(`  ✓ ${tag} deployed at: ${await contract.getAddress()}`);
  console.log(`    tx: ${receipt!.hash}`);
  console.log(`    gas used: ${receipt!.gasUsed.toString()}`);

  return contract as ethers.Contract;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  duude.fun — Meme Arena Launchpad — Contract Deployment");
  console.log("  Network: Arc Testnet (chainId " + CHAIN_ID + ")");
  console.log("═══════════════════════════════════════════════════════════");

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`\nDeployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} USDC (native)`);

  if (balance === 0n) {
    throw new Error("Deployer has zero balance. Fund the wallet first.");
  }

  // ── Step 1: FeeVault (no deps) ──────────────────────────────────────────
  console.log("\n── Step 1/11: FeeVault ──");
  const feeVault = await deployContract(wallet, "FeeVault");
  const feeVaultAddr = await feeVault.getAddress();

  // ── Step 2: LaunchToken impl (no deps) ──────────────────────────────────
  console.log("\n── Step 2/11: LaunchToken (implementation) ──");
  const launchTokenImpl = await deployContract(
    wallet,
    "LaunchToken",
    [],
    "LaunchToken (impl)"
  );
  const launchTokenImplAddr = await launchTokenImpl.getAddress();

  // ── Step 3: BondingCurve impl (no deps) ─────────────────────────────────
  console.log("\n── Step 3/11: BondingCurve (implementation) ──");
  const bondingCurveImpl = await deployContract(
    wallet,
    "BondingCurve",
    [],
    "BondingCurve (impl)"
  );
  const bondingCurveImplAddr = await bondingCurveImpl.getAddress();

  // ── Step 4: VestingVault impl (no deps) ─────────────────────────────────
  console.log("\n── Step 4/11: VestingVault (implementation) ──");
  const vestingVaultImpl = await deployContract(
    wallet,
    "VestingVault",
    [],
    "VestingVault (impl)"
  );
  const vestingVaultImplAddr = await vestingVaultImpl.getAddress();

  // ── Step 5: PostMigrationPool impl (no deps) ───────────────────────────
  console.log("\n── Step 5/11: PostMigrationPool (implementation) ──");
  const postMigrationPoolImpl = await deployContract(
    wallet,
    "PostMigrationPool",
    [],
    "PostMigrationPool (impl)"
  );
  const postMigrationPoolImplAddr = await postMigrationPoolImpl.getAddress();

  // ── Step 6: PostMigrationFactory (needs poolImpl + feeVault) ────────────
  console.log("\n── Step 6/11: PostMigrationFactory ──");
  const postMigrationFactory = await deployContract(
    wallet,
    "PostMigrationFactory",
    [postMigrationPoolImplAddr, feeVaultAddr]
  );
  const postMigrationFactoryAddr = await postMigrationFactory.getAddress();

  // ── Step 7: TokenFactory (needs all impls + postMigFactory + feeVault) ──
  console.log("\n── Step 7/11: TokenFactory ──");
  const tokenFactory = await deployContract(wallet, "TokenFactory", [
    launchTokenImplAddr,
    bondingCurveImplAddr,
    vestingVaultImplAddr,
    postMigrationFactoryAddr,
    feeVaultAddr,
    DEFAULT_CLIFF_DAYS,
  ]);
  const tokenFactoryAddr = await tokenFactory.getAddress();

  // ── Step 8: FeeVault.authorizeFactory(TokenFactory) ─────────────────────
  console.log("\n── Step 8/11: FeeVault.authorizeFactory(TokenFactory) ──");
  let tx = await feeVault.authorizeFactory(tokenFactoryAddr);
  let receipt = await tx.wait();
  console.log(`  ✓ FeeVault authorized TokenFactory`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Step 9: PostMigrationFactory.setAuthorizedFactory(TokenFactory) ─────
  console.log(
    "\n── Step 9/11: PostMigrationFactory.setAuthorizedFactory(TokenFactory) ──"
  );
  tx = await postMigrationFactory.setAuthorizedFactory(tokenFactoryAddr);
  receipt = await tx.wait();
  console.log(`  ✓ PostMigrationFactory authorized TokenFactory`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Step 10: ArenaRegistry (needs TokenFactory) ─────────────────────────
  console.log("\n── Step 10/11: ArenaRegistry ──");
  const arenaRegistry = await deployContract(wallet, "ArenaRegistry", [
    tokenFactoryAddr,
    BATTLE_DURATION,
  ]);
  const arenaRegistryAddr = await arenaRegistry.getAddress();

  // ── Step 11: TokenFactory.setArenaRegistry(ArenaRegistry) ───────────────
  console.log(
    "\n── Step 11/11: TokenFactory.setArenaRegistry(ArenaRegistry) ──"
  );
  tx = await tokenFactory.setArenaRegistry(arenaRegistryAddr);
  receipt = await tx.wait();
  console.log(`  ✓ TokenFactory linked to ArenaRegistry`);
  console.log(`    tx: ${receipt.hash}`);

  // ── Summary ─────────────────────────────────────────────────────────────
  const addresses = {
    FeeVault: feeVaultAddr,
    LaunchToken_Impl: launchTokenImplAddr,
    BondingCurve_Impl: bondingCurveImplAddr,
    VestingVault_Impl: vestingVaultImplAddr,
    PostMigrationPool_Impl: postMigrationPoolImplAddr,
    PostMigrationFactory: postMigrationFactoryAddr,
    TokenFactory: tokenFactoryAddr,
    ArenaRegistry: arenaRegistryAddr,
  };

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — All 8 contracts deployed");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\nDeployed Addresses:");
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`  ${name.padEnd(28)} ${addr}`);
  }

  // Save addresses to file
  const outputPath = join(__dirname, "..", "deployments.json");
  const output = {
    network: "arc-testnet",
    chainId: CHAIN_ID,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    addresses,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nAddresses saved to: ${outputPath}`);

  const finalBalance = await provider.getBalance(wallet.address);
  console.log(
    `\nFinal balance: ${ethers.formatEther(finalBalance)} USDC (native)`
  );
  console.log(
    `Total spent:   ${ethers.formatEther(balance - finalBalance)} USDC`
  );
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err);
  process.exit(1);
});
