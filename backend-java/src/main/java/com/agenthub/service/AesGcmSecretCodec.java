package com.agenthub.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AesGcmSecretCodec {
  private static final int NONCE_BYTES = 12;
  private static final int TAG_BITS = 128;
  private static final String PREFIX = "v1";

  private final SecretKeySpec keySpec;
  private final SecureRandom secureRandom = new SecureRandom();

  public AesGcmSecretCodec(@Value("${agenthub.auth.aes-key:}") String configuredKey) {
    this.keySpec = new SecretKeySpec(deriveKey(configuredKey), "AES");
  }

  public String encrypt(String plaintext) {
    try {
      byte[] nonce = new byte[NONCE_BYTES];
      secureRandom.nextBytes(nonce);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, nonce));
      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

      return PREFIX + ":"
          + Base64.getEncoder().encodeToString(nonce) + ":"
          + Base64.getEncoder().encodeToString(ciphertext);
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to encrypt secret", exception);
    }
  }

  public String decrypt(String payload) {
    try {
      String[] parts = payload.split(":", 3);
      if (parts.length != 3 || !PREFIX.equals(parts[0])) {
        throw new IllegalArgumentException("Unsupported secret format");
      }

      byte[] nonce = Base64.getDecoder().decode(parts[1]);
      byte[] ciphertext = Base64.getDecoder().decode(parts[2]);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, nonce));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to decrypt secret", exception);
    }
  }

  private byte[] deriveKey(String configuredKey) {
    String key = configuredKey == null ? "" : configuredKey.trim();

    if (!key.isEmpty()) {
      try {
        byte[] decoded = Base64.getDecoder().decode(key);
        if (decoded.length == 32) {
          return decoded;
        }
      } catch (IllegalArgumentException ignored) {
        // Fall back to a stable digest of the configured value.
      }
    }

    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return digest.digest(key.getBytes(StandardCharsets.UTF_8));
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to derive AES key", exception);
    }
  }
}
