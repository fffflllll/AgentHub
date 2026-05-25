package com.agenthub.service;

import com.agenthub.auth.CurrentUser;
import com.agenthub.common.BusinessException;
import com.agenthub.dto.request.UpdateUserRequest;
import com.agenthub.dto.response.UserResponse;
import com.agenthub.mapper.UserMapper;
import com.agenthub.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
  private static final int USER_NOT_FOUND_CODE = 40401;
  private static final int UNAUTHORIZED_CODE = 401;

  private final UserMapper userMapper;

  public UserService(UserMapper userMapper) {
    this.userMapper = userMapper;
  }

  public UserResponse getCurrentUser() {
    return UserResponse.from(requireCurrentUser());
  }

  @Transactional
  public UserResponse updateCurrentUser(UpdateUserRequest request) {
    User user = requireCurrentUser();
    user.setDisplayName(normalizeOptionalText(request.displayName()));
    user.setAvatarUrl(normalizeOptionalText(request.avatarUrl()));
    userMapper.update(user);
    return UserResponse.from(userMapper.findById(user.getId()));
  }

  private User requireCurrentUser() {
    String userId = CurrentUser.get();
    if (userId == null || userId.isBlank()) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, UNAUTHORIZED_CODE, "unauthorized");
    }

    User user = userMapper.findById(userId);
    if (user == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, USER_NOT_FOUND_CODE, "user not found");
    }

    return user;
  }

  private String normalizeOptionalText(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }

    return value.trim();
  }
}
