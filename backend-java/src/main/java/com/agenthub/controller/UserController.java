package com.agenthub.controller;

import com.agenthub.common.ApiResponse;
import com.agenthub.dto.response.UserResponse;
import com.agenthub.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {
  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @GetMapping("/me")
  public ApiResponse<UserResponse> me() {
    return ApiResponse.success(userService.getCurrentUser());
  }
}
