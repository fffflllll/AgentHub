package com.agenthub.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
    @Size(max = 50) String displayName,
    @Size(max = 500) String avatarUrl) {}
