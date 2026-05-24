package com.agenthub.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {
  private static final String USER_ID_CLAIM = "userId";
  private static final long TOKEN_TTL_SECONDS = 7L * 24L * 60L * 60L;

  private final Algorithm algorithm;
  private final JWTVerifier verifier;

  public JwtTokenProvider(@Value("${agenthub.auth.jwt-secret:}") String jwtSecret) {
    validateSecret(jwtSecret);
    this.algorithm = Algorithm.HMAC256(jwtSecret);
    this.verifier = JWT.require(algorithm).build();
  }

  public String generateToken(String userId) {
    Instant now = Instant.now();
    return JWT.create()
        .withClaim(USER_ID_CLAIM, userId)
        .withIssuedAt(now)
        .withExpiresAt(now.plusSeconds(TOKEN_TTL_SECONDS))
        .sign(algorithm);
  }

  public String validateToken(String token) {
    DecodedJWT jwt = verifier.verify(token);
    String userId = jwt.getClaim(USER_ID_CLAIM).asString();
    if (userId == null || userId.isBlank()) {
      throw new JWTVerificationException("missing userId claim");
    }
    return userId;
  }

  private void validateSecret(String jwtSecret) {
    if (jwtSecret == null || jwtSecret.isBlank()) {
      throw new IllegalStateException("JWT_SECRET must be configured");
    }
    if (jwtSecret.length() < 32) {
      throw new IllegalStateException("JWT_SECRET must be at least 32 characters");
    }
    if (jwtSecret.startsWith("change-me") || jwtSecret.startsWith("replace-with")) {
      throw new IllegalStateException("JWT_SECRET must not use a placeholder value");
    }
  }
}
