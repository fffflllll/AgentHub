package com.agenthub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateProviderRequest(
    @NotBlank @Size(max = 20) String providerType,
    @NotBlank @Size(max = 500) String apiKey,
    @Size(max = 500) String baseUrl,
    @NotBlank @Size(max = 100) String defaultModel,
    Boolean isDefault) {}
