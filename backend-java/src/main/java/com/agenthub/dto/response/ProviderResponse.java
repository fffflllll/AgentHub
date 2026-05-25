package com.agenthub.dto.response;

import com.agenthub.model.UserProvider;
import java.time.LocalDateTime;

public record ProviderResponse(
    String id,
    String providerType,
    String baseUrl,
    String defaultModel,
    boolean isDefault,
    LocalDateTime createdAt,
    LocalDateTime updatedAt) {
  public static ProviderResponse from(UserProvider provider) {
    return new ProviderResponse(
        provider.getId(),
        provider.getProviderType(),
        provider.getBaseUrl(),
        provider.getDefaultModel(),
        provider.isDefaultProvider(),
        provider.getCreatedAt(),
        provider.getUpdatedAt());
  }
}
