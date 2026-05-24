package com.agenthub.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(min = 2, max = 20) String username,
    @NotBlank @Size(min = 6, max = 100) String password) {}
