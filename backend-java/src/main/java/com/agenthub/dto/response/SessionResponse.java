package com.agenthub.dto.response;

import java.time.LocalDateTime;

public record SessionResponse(String id, String name, String type, String lastMessage, LocalDateTime updatedAt) {}
