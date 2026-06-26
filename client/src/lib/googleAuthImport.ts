/**
 * Parser para o formato de exportação do Google Authenticator
 * Formato: otpauth-migration://offline?data=BASE64_ENCODED_PROTOBUF
 *
 * O protobuf tem a seguinte estrutura (baseada em engenharia reversa):
 * message MigrationPayload {
 *   repeated OtpParameters otp_parameters = 1;
 *   int32 version = 2;
 *   int32 batch_size = 3;
 *   int32 batch_index = 4;
 *   int32 batch_id = 5;
 * }
 * message OtpParameters {
 *   bytes secret = 1;
 *   string name = 2;
 *   string issuer = 3;
 *   Algorithm algorithm = 4;
 *   DigitCount digits = 5;
 *   OtpType type = 6;
 *   int64 counter = 7;
 * }
 */

export interface ImportedAccount {
  name: string;
  secret: string;
  issuer?: string;
}

// Base32 encoding table
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let result = "";
  let bits = 0;
  let value = 0;

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Decodifica um varint protobuf de um Uint8Array a partir de um offset.
 * Retorna [valor, novos_bytes_consumidos]
 */
function decodeVarint(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;

  while (pos < bytes.length) {
    const byte = bytes[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
  }

  return [result, pos - offset];
}

/**
 * Parser manual de protobuf para extrair as contas do Google Authenticator.
 * Implementação manual para evitar dependência de protobufjs no bundle.
 */
function parseProtobuf(bytes: Uint8Array): ImportedAccount[] {
  const accounts: ImportedAccount[] = [];
  let pos = 0;

  while (pos < bytes.length) {
    // Ler field tag
    const [tag, tagLen] = decodeVarint(bytes, pos);
    pos += tagLen;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 2) {
      // Length-delimited (bytes, string, embedded message)
      const [length, lenLen] = decodeVarint(bytes, pos);
      pos += lenLen;
      const fieldBytes = bytes.slice(pos, pos + length);
      pos += length;

      if (fieldNumber === 1) {
        // otp_parameters - embedded message
        const account = parseOtpParameters(fieldBytes);
        if (account) accounts.push(account);
      }
    } else if (wireType === 0) {
      // Varint
      const [, varLen] = decodeVarint(bytes, pos);
      pos += varLen;
    } else if (wireType === 1) {
      // 64-bit
      pos += 8;
    } else if (wireType === 5) {
      // 32-bit
      pos += 4;
    } else {
      // Unknown wire type, skip
      break;
    }
  }

  return accounts;
}

function parseOtpParameters(bytes: Uint8Array): ImportedAccount | null {
  let pos = 0;
  let secret: Uint8Array | null = null;
  let name = "";
  let issuer = "";

  while (pos < bytes.length) {
    const [tag, tagLen] = decodeVarint(bytes, pos);
    pos += tagLen;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 2) {
      const [length, lenLen] = decodeVarint(bytes, pos);
      pos += lenLen;
      const fieldBytes = bytes.slice(pos, pos + length);
      pos += length;

      if (fieldNumber === 1) {
        // secret (bytes)
        secret = fieldBytes;
      } else if (fieldNumber === 2) {
        // name (string)
        name = new TextDecoder().decode(fieldBytes);
      } else if (fieldNumber === 3) {
        // issuer (string)
        issuer = new TextDecoder().decode(fieldBytes);
      }
    } else if (wireType === 0) {
      const [, varLen] = decodeVarint(bytes, pos);
      pos += varLen;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }

  if (!secret || !name) return null;

  return {
    name,
    secret: base32Encode(secret),
    issuer: issuer || undefined,
  };
}

/**
 * Decodifica um URL otpauth-migration://offline?data=...
 * e retorna a lista de contas importadas.
 */
export function parseGoogleAuthMigration(uri: string): ImportedAccount[] | null {
  try {
    if (!uri.startsWith("otpauth-migration://")) return null;

    const url = new URL(uri);
    const data = url.searchParams.get("data");
    if (!data) return null;

    // Decodificar base64 (pode ter caracteres URL-encoded)
    const base64 = decodeURIComponent(data);
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return parseProtobuf(bytes);
  } catch (e) {
    console.error("Erro ao parsear otpauth-migration:", e);
    return null;
  }
}

/**
 * Tenta parsear qualquer URI de autenticador:
 * - otpauth://totp/... (padrão)
 * - otpauth-migration://offline?data=... (exportação do Google Authenticator)
 */
export function parseAnyAuthUri(
  uri: string
): { single: ImportedAccount } | { multiple: ImportedAccount[] } | null {
  if (uri.startsWith("otpauth-migration://")) {
    const accounts = parseGoogleAuthMigration(uri);
    if (accounts && accounts.length > 0) {
      return { multiple: accounts };
    }
    return null;
  }

  if (uri.startsWith("otpauth://")) {
    try {
      const url = new URL(uri);
      const label = decodeURIComponent(url.pathname.slice(2));
      const secret = url.searchParams.get("secret") || "";
      const issuer = url.searchParams.get("issuer") || undefined;

      const colonIdx = label.indexOf(":");
      const name = colonIdx >= 0 ? label.slice(colonIdx + 1).trim() : label.trim();
      const parsedIssuer = colonIdx >= 0 ? label.slice(0, colonIdx).trim() : issuer;

      if (!secret) return null;

      return { single: { name: name || label, secret, issuer: parsedIssuer } };
    } catch {
      return null;
    }
  }

  return null;
}
