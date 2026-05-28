import { CREDITS_PER_USDC, USDC_MINOR_UNITS } from "./constants";

export function creditsToUsdcMinor(credits: number) {
  return Math.ceil((credits * USDC_MINOR_UNITS) / CREDITS_PER_USDC);
}

export function usdcMinorToCredits(usdcMinor: number) {
  return Math.floor((usdcMinor * CREDITS_PER_USDC) / USDC_MINOR_UNITS);
}

export function formatUsdc(usdcMinor: number) {
  return (usdcMinor / USDC_MINOR_UNITS).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

export function parseUsdcToMinor(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("USDC amount must be positive.");
  }

  return Math.round(value * USDC_MINOR_UNITS);
}
