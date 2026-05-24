package com.agenthub.controller;

import com.agenthub.common.ApiResponse;
import com.agenthub.dto.response.AgentResponse;
import com.agenthub.service.AgentService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents")
public class AgentController {
  private final AgentService agentService;

  public AgentController(AgentService agentService) {
    this.agentService = agentService;
  }

  @GetMapping
  public ApiResponse<List<AgentResponse>> listAgents() {
    return ApiResponse.success(agentService.listAgents());
  }
}
