package com.agenthub.controller;

import com.agenthub.common.ApiResponse;
import com.agenthub.dto.response.SessionResponse;
import com.agenthub.service.SessionService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {
  private final SessionService sessionService;

  public SessionController(SessionService sessionService) {
    this.sessionService = sessionService;
  }

  @GetMapping
  public ApiResponse<List<SessionResponse>> listSessions() {
    return ApiResponse.success(sessionService.listCurrentUserSessions());
  }
}
