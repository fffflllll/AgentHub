package com.agenthub.service;

import com.agenthub.dto.response.SessionResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
  public List<SessionResponse> listCurrentUserSessions() {
    return List.of();
  }
}
