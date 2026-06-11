// BlockRun x402 types
// BlockRun is a separate x402 payment service with its own Pact management

export type BlockRunX402Request = {
  walletAddress: string;
  pactId: string;
  usdAmount: number;
};

export type BlockRunX402Step = {
  received402: boolean;
  price?: string; // "0.001000 USD"
  signed: boolean | null;
  txHash: string | null;
  gotResult: boolean;
};

export type BlockRunX402Result = {
  status: "completed" | "failed";
  responseStatus: number;
  responseBody: string;
  durationMs: number;
  error?: string;
  steps?: BlockRunX402Step;
};

export type BlockRunPactStatus = {
  hasPact: boolean;
  pactId?: string;
  network?: string;
  status?: string;
  singleLimitUsd?: number;
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
  expiresAt?: string;
  error?: string;
};
