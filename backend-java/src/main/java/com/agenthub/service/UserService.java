package com.agenthub.service;

import com.agenthub.auth.CurrentUser;
import com.agenthub.common.BusinessException;
import com.agenthub.dto.response.UserResponse;
import com.agenthub.mapper.UserMapper;
import com.agenthub.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class UserService {
  private static final int USER_NOT_FOUND_CODE = 40401;
  private static final int UNAUTHORIZED_CODE = 401;

  private final UserMapper userMapper;

  public UserService(UserMapper userMapper) {
    this.userMapper = userMapper;
  }

  public UserResponse getCurrentUser() {
    String userId = CurrentUser.get();
    if (userId == null || userId.isBlank()) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, UNAUTHORIZED_CODE, "unauthorized");
    }

    User user = userMapper.findById(userId);
    if (user == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, USER_NOT_FOUND_CODE, "user not found");
    }

    return UserResponse.from(user);
  }
}
