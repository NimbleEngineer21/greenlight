const ITERATIONS = 600_000;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: "greenlight-encrypted-v1",
    algorithm: "AES-GCM",
    kdf: "PBKDF2",
    kdfIterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptData(envelope, password) {
  if (envelope.format !== "greenlight-encrypted-v1") {
    throw new Error(`Unknown file format: ${envelope.format}`);
  }
  if (!envelope.salt || !envelope.iv || !envelope.payload) {
    throw new Error("This backup file is missing required fields (salt, iv, or payload). The file may be corrupted or truncated.");
  }
  const key = await deriveKey(password, base64ToBytes(envelope.salt));
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.payload)
    );
  } catch {
    throw new Error("Wrong password or corrupted file.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Backup decrypted successfully but the data could not be parsed. The file may be corrupted.");
  }
}
