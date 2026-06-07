# Settlement Flow

## Networks

Recommended progression:

1. Local chain for contract tests.
2. Base Sepolia for CAW/testnet integration.
3. Base mainnet after audit and operational controls.

USDC addresses must be configured per network. Do not reuse mainnet addresses on testnet without verification.

## Contract Test Cases

Test `CreditsPayment.sol` for:

- constructor rejects zero USDC address.
- constructor rejects zero treasury address.
- constructor rejects zero rate.
- `buyCredits` rejects zero order id.
- `buyCredits` rejects zero credit account.
- `buyCredits` rejects zero amount.
- duplicate order id reverts.
- successful payment transfers USDC to treasury.
- successful payment emits `CreditsPurchased` with expected credits.

## Deployment Outputs

Deployment should record:

- network name and chain id.
- USDC token address.
- treasury address.
- `CreditsPayment` address.
- credits per USDC.
- deployer address.
- deployment transaction hash.

Add these values to environment variables or deployment docs before using the listener.

## Event Listener Shape

Listener responsibilities:

```text
poll or subscribe to CreditsPurchased
  -> wait confirmations
  -> derive event id from tx hash + log index
  -> call settlement with order id, amount, tx hash, event id
  -> persist last processed block only after successful handling
```

If the listener calls the HTTP webhook, sign requests. If it imports domain code directly, keep a single settlement function to avoid divergent behavior.
