package com.agenthub.service;

import com.agenthub.auth.JwtTokenProvider;
import com.agenthub.common.BusinessException;
import com.agenthub.dto.request.LoginRequest;
import com.agenthub.dto.request.RegisterRequest;
import com.agenthub.dto.response.AuthResponse;
import com.agenthub.dto.response.UserResponse;
import com.agenthub.mapper.UserMapper;
import com.agenthub.model.User;
import java.util.UUID;
import org.mindrot.jbcrypt.BCrypt;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private static final Logger log = LoggerFactory.getLogger(AuthService.class);
  private static final int USERNAME_EXISTS_CODE = 40901;
  private static final int INVALID_CREDENTIALS_CODE = 40101;

  private final UserMapper userMapper;
  private final JwtTokenProvider jwtTokenProvider;

  public AuthService(UserMapper userMapper, JwtTokenProvider jwtTokenProvider) {
    this.userMapper = userMapper;
    this.jwtTokenProvider = jwtTokenProvider;
  }

  @Transactional
  public AuthResponse register(RegisterRequest request) {
    String username = request.username().trim();
    if (userMapper.findByUsername(username) != null) {
      log.info("Registration rejected because username already exists: {}", username);
      throw new BusinessException(HttpStatus.CONFLICT, USERNAME_EXISTS_CODE, "username already exists");
    }

    User user = new User();
    user.setId(UUID.randomUUID().toString());
    user.setUsername(username);
    user.setPasswordHash(BCrypt.hashpw(request.password(), BCrypt.gensalt()));
    user.setDisplayName(username);
    userMapper.insert(user);
    log.info("Registered user id={} username={}", user.getId(), user.getUsername());

    String token = jwtTokenProvider.generateToken(user.getId());
    return new AuthResponse(token, UserResponse.from(user));
  }

  public AuthResponse login(LoginRequest request) {
    String username = request.username().trim();
    User user = userMapper.findByUsername(username);
    if (user == null || !BCrypt.checkpw(request.password(), user.getPasswordHash())) {
      log.info("Login rejected for username={}", username);
      throw new BusinessException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS_CODE, "invalid username or password");
    }

    log.info("User logged in id={} username={}", user.getId(), user.getUsername());
    String token = jwtTokenProvider.generateToken(user.getId());
    return new AuthResponse(token, UserResponse.from(user));
  }
}
