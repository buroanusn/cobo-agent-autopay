import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

loadEnv(path.join(rootDir, ".env"));

if (dryRun) {
  const { abi, bytecode } = compileContract();
  console.log("CreditsPayment compiled successfully.");
  console.log(`  abi entries: ${abi.length}`);
  console.log(`  bytecode bytes: ${(bytecode.length - 2) / 2}`);
  process.exit(0);
}

const chainEnv = process.env.CHAIN_ENV === "base-mainnet" ? "base-mainnet" : "base-sepolia";
const chain = chainEnv === "base-mainnet" ? base : baseSepolia;
const rpcUrl = requiredEnv("BASE_RPC_URL");
const privateKey = normalizePrivateKey(requiredEnv("DEPLOYER_PRIVATE_KEY"));
const usdcAddress =
  process.env.USDC_ADDRESS ||
  (chainEnv === "base-mainnet"
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
const treasuryAddress = process.env.TREASURY_ADDRESS;
const creditsPerUsdc = BigInt(process.env.CREDITS_PER_USDC || "1000");

if (!isAddress(usdcAddress)) {
  throw new Error(`USDC_ADDRESS is invalid: ${usdcAddress}`);
}

if (!treasuryAddress || !isAddress(treasuryAddress)) {
  throw new Error("TREASURY_ADDRESS is required and must be a valid EVM address.");
}

if (creditsPerUsdc <= 0n) {
  throw new Error("CREDITS_PER_USDC must be a positive integer.");
}

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl)
});
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl)
});

const { abi, bytecode } = compileContract();

console.log("Deploying CreditsPayment...");
console.log(`  chain: ${chain.name} (${chain.id})`);
console.log(`  deployer: ${account.address}`);
console.log(`  usdc: ${usdcAddress}`);
console.log(`  treasury: ${treasuryAddress}`);
console.log(`  creditsPerUsdc: ${creditsPerUsdc.toString()}`);

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: [usdcAddress, treasuryAddress, creditsPerUsdc]
});

console.log(`Submitted deployment tx: ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (!receipt.contractAddress) {
  throw new Error("Deployment transaction was mined but no contract address was returned.");
}

console.log("Deployment confirmed.");
console.log(`PAYMENT_CONTRACT_ADDRESS=${receipt.contractAddress}`);
console.log(`Explorer: ${chain.blockExplorers?.default.url}/address/${receipt.contractAddress}`);
console.log("");
console.log("Next steps:");
console.log("1. Add PAYMENT_CONTRACT_ADDRESS above to .env.");
console.log("2. Ensure the CAW wallet has Base Sepolia ETH and test USDC.");
console.log("3. Ensure the CAW wallet grants USDC allowance to this contract before buyCredits calls.");

function compileContract() {
  const contractPath = path.join(rootDir, "contracts", "CreditsPayment.sol");
  const source = readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "CreditsPayment.sol": {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === "error") ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  }

  const artifact = output.contracts?.["CreditsPayment.sol"]?.CreditsPayment;
  if (!artifact?.abi || !artifact?.evm?.bytecode?.object) {
    throw new Error("CreditsPayment artifact was not produced by solc.");
  }

  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`
  };
}

function loadEnv(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsAt).trim();
    const rawValue = trimmed.slice(equalsAt + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquote(rawValue);
  }
}

function unquote(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizePrivateKey(value) {
  const key = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return key;
}
