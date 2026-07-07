/**
 * Thai PromptPay QR payload generator (EMVCo Merchant-Presented QR).
 * No dependencies — TLV encoding + CRC16-CCITT (FALSE).
 * Scannable by every Thai banking app with the amount pre-filled.
 */

const PROMPTPAY_AID = "A000000677010111";

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

/** CRC16-CCITT (FALSE): poly 0x1021, init 0xFFFF */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Phone "0812345678" → "0066812345678"; 13-digit citizen ID passes through. */
function normalizeTarget(target: string): { tag: string; value: string } {
  const digits = target.replace(/\D/g, "");
  if (digits.length === 13) return { tag: "02", value: digits }; // citizen ID
  if (digits.length === 10 && digits.startsWith("0")) {
    return { tag: "01", value: `0066${digits.slice(1)}` }; // mobile
  }
  if (digits.length === 12 && digits.startsWith("66")) {
    return { tag: "01", value: `00${digits}` };
  }
  if (digits.length === 15) return { tag: "03", value: digits }; // e-wallet
  throw new Error(`Invalid PromptPay target: ${target}`);
}

export function buildPromptPayPayload(
  target: string,
  amountThb?: number
): string {
  const { tag, value } = normalizeTarget(target);

  const merchantInfo = tlv("29", tlv("00", PROMPTPAY_AID) + tlv(tag, value));

  let payload =
    tlv("00", "01") + // payload format indicator
    tlv("01", amountThb != null ? "12" : "11") + // dynamic if amount present
    merchantInfo +
    tlv("53", "764") + // currency: THB
    (amountThb != null ? tlv("54", amountThb.toFixed(2)) : "") +
    tlv("58", "TH");

  payload += "6304"; // CRC tag + length placeholder
  return payload + crc16(payload);
}
