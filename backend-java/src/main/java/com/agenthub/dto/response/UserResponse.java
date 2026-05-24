package com.agenthub.dto.response;

import com.agenthub.model.User;

public record UserResponse(String id, String username, String displayName, String avatarUrl) {
  public static UserResponse from(User user) {
    return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getAvatarUrl());
  }
}
