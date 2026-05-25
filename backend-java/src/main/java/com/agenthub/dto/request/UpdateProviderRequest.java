package com.agenthub.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateProviderRequest(
    @Size(max = 20) String providerType,
    @Size(max = 500) String apiKey,
    @Size(max = 500) String baseUrl,
    @Size(max = 100) String defaultModel,
    Boolean isDefault) {}
