package com.agenthub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
    @NotBlank @Size(min = 2, max = 20) String username,
    @NotBlank @Size(min = 8, max = 100) String password) {}
