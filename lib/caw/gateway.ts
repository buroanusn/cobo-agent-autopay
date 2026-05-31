import { getConfiguredCawChainId, getConfiguredChain } from "@/lib/domain/constants";
import { Configuration, FaucetApi, PactsApi, TransactionsApi, WalletsApi } from "@cobo/agentic-wallet";
import { encodeFunctionData } from "viem";

export type CreatePactInput = {
  userId: string;
  walletAddress: string;
  contractAddress?: string;
  usdcAddress: string;
  singleLimitUsdcMinor: number;
  dailyLimitUsdcMinor: number;
  monthlyLimitUsdcMinor: number;
  expiresAt: string;
};

export type ExecuteCreditsPurchaseInput = {
  userId: string;
  walletAddress: string;
  pactId: string;
  pactApiKey?: string;
  paymentContractAddress?: string;
  usdcAddress: string;
  orderId: string;
  onchainOrderId: string;
  amountUsdcMinor: number;
  credits: number;
};

export type CawPactStatus = {
  pactId: string;
  status: "pending_user_approval" | "active" | "expired" | "revoked";
  pactApiKey?: string;
};

export type CawGateway = {
  createPairingCode(input: { userId: string }): Promise<{
    code: string;
    expiresAt: string;
    status: "generated";
  }>;
  connectWallet(input: {
    userId: string;
    walletAddress: string;
  }): Promise<{ connectionId: string; walletAddress: string }>;
  createPact(input: CreatePactInput): Promise<{
    pactId: string;
    status: "active" | "pending_user_approval";
    approvalUrl?: string;
    pactApiKey?: string;
  }>;
  getPact(input: { pactId: string }): Promise<CawPactStatus>;
  requestFaucet(input: { walletAddress: string; tokenId?: string }): Promise<{
    address: string;
    tokenId: string;
    amount: string;
  }>;
  executeCreditsPurchase(input: ExecuteCreditsPurchaseInput): Promise<{
    txHash: string;
    status: "submitted" | "confirmed";
    mockConfirmed: boolean;
  }>;
};

class MockCawGateway implements CawGateway {
  async createPairingCode(input: { userId: string }) {
    const seed = input.userId.replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase() || "DEMO1";
    return {
      code: `CAW-${seed}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: "generated" as const
    };
  }

  async connectWallet(input: { userId: string; walletAddress: string }) {
    return {
      connectionId: `mock_conn_${input.userId}`,
      walletAddress: input.walletAddress
    };
  }

  async createPact(input: CreatePactInput) {
    const suffix = input.walletAddress.slice(2, 10).toLowerCase();
    return {
      pactId: `mock_pact_${suffix}`,
      status: "active" as const,
      pactApiKey: `mock_pact_key_${suffix}`
    };
  }

  async getPact(input: { pactId: string }) {
    return {
      pactId: input.pactId,
      status: "active" as const,
      pactApiKey: `mock_pact_key_${input.pactId.slice(-8)}`
    };
  }

  async requestFaucet(input: { walletAddress: string; tokenId?: string }) {
    return {
      address: input.walletAddress,
      tokenId: input.tokenId ?? getDefaultFaucetTokenId(),
      amount: "mock"
    };
  }

  async executeCreditsPurchase(input: ExecuteCreditsPurchaseInput) {
    return {
      txHash: `0xmock${input.onchainOrderId.slice(2, 62)}`,
      status: "confirmed" as const,
      mockConfirmed: true
    };
  }
}

class HttpCawGateway implements CawGateway {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly walletId: string;

  constructor() {
    this.baseUrl = requiredEnvAlias(["AGENT_WALLET_API_URL", "CAW_API_BASE_URL"]).replace(
      /\/$/,
      ""
    );
    this.apiKey = requiredEnvAlias(["AGENT_WALLET_API_KEY", "CAW_API_KEY"]);
    this.walletId = requiredEnvAlias(["AGENT_WALLET_WALLET_ID", "CAW_WALLET_ID"]);
  }

  async createPairingCode() {
    const result = (
      await this.walletsApi().initiateWalletPair({
        wallet_id: this.walletId
      })
    ).data.result;

    return {
      code: result.token,
      expiresAt: result.expires_at,
      status: "generated" as const
    };
  }

  async connectWallet(input: { userId: string; walletAddress: string }) {
    const addresses = (await this.walletsApi().listWalletAddresses(this.walletId)).data.result;
    const firstAddress = Array.isArray(addresses) ? addresses[0] : undefined;
    const source = (firstAddress ?? {}) as Record<string, unknown>;

    return {
      connectionId: this.walletId,
      walletAddress:
        stringField(source, "address", "") ||
        stringField(source, "addr", "") ||
        process.env.CAW_WALLET_ADDRESS ||
        input.walletAddress
    };
  }

  async createPact(input: CreatePactInput) {
    const chain = getConfiguredChain();
    const coboChainId = getConfiguredCawChainId();
    const contractAddress = requiredInput(input.contractAddress, "PAYMENT_CONTRACT_ADDRESS");
    const response = await this.pactsApi().submitPact({
      wallet_id: this.walletId,
      name: "Agent credits auto top-up",
      intent:
        "Allow the agent to top up internal credits by calling the configured CreditsPayment contract on testnet within strict spending limits.",
      original_intent: "CAW small auto-payment demo for agent token top-ups.",
      spec: {
        policies: [
          {
            name: "credits-payment-contract-call",
            type: "contract_call",
            rules: {
              effect: "allow",
              when: {
                chain_in: [coboChainId],
                contract_addr_in: [contractAddress],
                function_in: ["buyCredits(bytes32,address,uint256)"]
              },
              deny_if: {
                amount_usd_gt: usdcMinorToUsdString(input.singleLimitUsdcMinor)
              }
            },
            priority: 100,
            is_active: true
          }
        ],
        completion_conditions: [
          {
            type: "time_elapsed",
            threshold: Math.max(
              1,
              Math.ceil((Date.parse(input.expiresAt) - Date.now()) / 1000)
            ).toString()
          },
          {
            type: "amount_spent_usd",
            threshold: usdcMinorToUsdString(input.monthlyLimitUsdcMinor)
          }
        ],
        execution_plan: [
          "# Summary",
          "The agent may initiate small testnet USDC credit top-ups without manual approval.",
          "# Contract Operations",
          `Call ${contractAddress} on ${chain.name} using buyCredits(bytes32,address,uint256).`,
          "# Risk Controls",
          `Single transaction limit: ${usdcMinorToUsdString(input.singleLimitUsdcMinor)} USDC.`,
          `Monthly completion amount: ${usdcMinorToUsdString(input.monthlyLimitUsdcMinor)} USDC.`
        ].join("\n\n")
      }
    });

    const pactId = response.data.result.pact_id;
    const pact = await this.getPact({ pactId }).catch(() => undefined);
    const status = pact?.status === "active" ? ("active" as const) : ("pending_user_approval" as const);

    return {
      pactId,
      status,
      pactApiKey: pact?.pactApiKey
    };
  }

  async getPact(input: { pactId: string }) {
    const pact = (await this.pactsApi().getPact(input.pactId)).data.result;
    return {
      pactId: pact.id,
      status: normalizePactStatus(pact.status),
      pactApiKey: pact.api_key
    };
  }

  async requestFaucet(input: { walletAddress: string; tokenId?: string }) {
    const response = await this.faucetApi().deposit({
      address: input.walletAddress,
      token_id: input.tokenId ?? getDefaultFaucetTokenId()
    });
    const result = response.data.result;
    return {
      address: result.address,
      tokenId: result.token_id,
      amount: result.amount
    };
  }

  async executeCreditsPurchase(input: ExecuteCreditsPurchaseInput) {
    const pactApiKey = input.pactApiKey || process.env.CAW_PACT_API_KEY;
    if (!pactApiKey) {
      throw new Error(
        "CAW Pact is not active yet. Ask the user to approve it in Cobo App, then refresh authorization before paying."
      );
    }

    const calldata = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "buyCredits",
          stateMutability: "nonpayable",
          inputs: [
            { name: "orderId", type: "bytes32" },
            { name: "creditAccount", type: "address" },
            { name: "amountUsdc", type: "uint256" }
          ],
          outputs: []
        }
      ],
      functionName: "buyCredits",
      args: [
        input.onchainOrderId as `0x${string}`,
        input.walletAddress as `0x${string}`,
        BigInt(input.amountUsdcMinor)
      ]
    });

    const result = (
      await this.transactionsApi(pactApiKey).contractCall(this.walletId, {
        chain_id: getConfiguredCawChainId(),
        contract_addr: requiredInput(input.paymentContractAddress, "PAYMENT_CONTRACT_ADDRESS"),
        value: "0",
        calldata,
        request_id: input.orderId,
        description: `Agent credits top-up ${input.orderId}`
      })
    ).data.result;

    return {
      txHash: result.transaction_hash ?? result.id ?? "",
      status: result.status >= 900 ? ("confirmed" as const) : ("submitted" as const),
      mockConfirmed: false
    };
  }

  private ownerConfig() {
    return new Configuration({ apiKey: this.apiKey, basePath: this.baseUrl });
  }

  private pactConfig(apiKey: string) {
    return new Configuration({ apiKey, basePath: this.baseUrl });
  }

  private walletsApi() {
    return new WalletsApi(this.ownerConfig());
  }

  private pactsApi() {
    return new PactsApi(this.ownerConfig());
  }

  private transactionsApi(pactApiKey: string) {
    return new TransactionsApi(this.pactConfig(pactApiKey));
  }

  private faucetApi() {
    return new FaucetApi(this.ownerConfig());
  }
}

export function createCawGateway(): CawGateway {
  return process.env.CAW_MODE === "http" ? new HttpCawGateway() : new MockCawGateway();
}

function requiredEnvAlias(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  throw new Error(`${names.join(" or ")} is required when CAW_MODE=http.`);
}

function requiredInput(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required for real CAW contract calls.`);
  }
  return value;
}

function getDefaultFaucetTokenId() {
  return process.env.CAW_FAUCET_TOKEN_ID || (process.env.CHAIN_ENV === "base-mainnet" ? "BASE_ETH_USDC" : "BASE_SEPOLIA_USDC");
}

function usdcMinorToUsdString(amountUsdcMinor: number) {
  return (amountUsdcMinor / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizePactStatus(status: string | undefined): CawPactStatus["status"] {
  if (status === "active") {
    return "active";
  }
  if (status === "expired" || status === "completed") {
    return "expired";
  }
  if (status === "revoked" || status === "rejected") {
    return "revoked";
  }
  return "pending_user_approval";
}

function stringField(source: Record<string, unknown>, key: string, fallback: string) {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
