import { BASE_CHAIN } from "@/lib/domain/constants";

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
  paymentContractAddress?: string;
  usdcAddress: string;
  orderId: string;
  onchainOrderId: string;
  amountUsdcMinor: number;
  credits: number;
};

export type CawGateway = {
  connectWallet(input: {
    userId: string;
    walletAddress: string;
  }): Promise<{ connectionId: string; walletAddress: string }>;
  createPact(input: CreatePactInput): Promise<{
    pactId: string;
    status: "active" | "pending_user_approval";
    approvalUrl?: string;
  }>;
  executeCreditsPurchase(input: ExecuteCreditsPurchaseInput): Promise<{
    txHash: string;
    status: "submitted" | "confirmed";
    mockConfirmed: boolean;
  }>;
};

class MockCawGateway implements CawGateway {
  async connectWallet(input: { userId: string; walletAddress: string }) {
    return {
      connectionId: `mock_conn_${input.userId}`,
      walletAddress: input.walletAddress
    };
  }

  async createPact(input: CreatePactInput) {
    return {
      pactId: `mock_pact_${input.walletAddress.slice(2, 10).toLowerCase()}`,
      status: "active" as const
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

  constructor() {
    this.baseUrl = requiredEnv("CAW_API_BASE_URL").replace(/\/$/, "");
    this.apiKey = requiredEnv("CAW_API_KEY");
  }

  async connectWallet(input: { userId: string; walletAddress: string }) {
    const result = await this.post(envPath("CAW_CONNECT_PATH", "/v1/wallets/connect"), input);
    return {
      connectionId: stringField(result, "connectionId", `caw_conn_${input.userId}`),
      walletAddress: stringField(result, "walletAddress", input.walletAddress)
    };
  }

  async createPact(input: CreatePactInput) {
    const result = await this.post(envPath("CAW_CREATE_PACT_PATH", "/v1/pacts"), {
      subject: {
        user_id: input.userId,
        wallet_address: input.walletAddress
      },
      scope: {
        chain_id: BASE_CHAIN.id,
        token: input.usdcAddress,
        payment_contract: input.contractAddress,
        allowed_action: "credits_purchase"
      },
      policy: {
        single_limit_usdc_minor: input.singleLimitUsdcMinor,
        daily_limit_usdc_minor: input.dailyLimitUsdcMinor,
        monthly_limit_usdc_minor: input.monthlyLimitUsdcMinor,
        expires_at: input.expiresAt
      }
    });

    return {
      pactId: stringField(result, "pactId", stringField(result, "id", "")),
      status:
        stringField(result, "status", "pending_user_approval") === "active"
          ? ("active" as const)
          : ("pending_user_approval" as const),
      approvalUrl: optionalStringField(result, "approvalUrl")
    };
  }

  async executeCreditsPurchase(input: ExecuteCreditsPurchaseInput) {
    const result = await this.post(
      envPath("CAW_EXECUTE_PURCHASE_PATH", "/v1/pacts/execute-contract-call"),
      {
        pact_id: input.pactId,
        request_id: input.orderId,
        wallet_address: input.walletAddress,
        chain_id: BASE_CHAIN.id,
        target_contract: input.paymentContractAddress,
        action: "buyCredits",
        params: {
          order_id: input.onchainOrderId,
          credit_account: input.walletAddress,
          usdc_token: input.usdcAddress,
          usdc_amount_minor: input.amountUsdcMinor,
          credits: input.credits
        }
      }
    );

    return {
      txHash: stringField(result, "txHash", stringField(result, "transactionHash", "")),
      status:
        stringField(result, "status", "submitted") === "confirmed"
          ? ("confirmed" as const)
          : ("submitted" as const),
      mockConfirmed: false
    };
  }

  private async post(path: string, payload: unknown) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CAW request failed: ${response.status} ${text}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export function createCawGateway(): CawGateway {
  return process.env.CAW_MODE === "http" ? new HttpCawGateway() : new MockCawGateway();
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when CAW_MODE=http.`);
  }
  return value;
}

function envPath(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function stringField(source: Record<string, unknown>, key: string, fallback: string) {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
