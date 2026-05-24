package com.agenthub.service;

import com.agenthub.dto.response.AgentResponse;
import com.agenthub.mapper.AgentMapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AgentService {
  private final AgentMapper agentMapper;

  public AgentService(AgentMapper agentMapper) {
    this.agentMapper = agentMapper;
  }

  public List<AgentResponse> listAgents() {
    return agentMapper.findAll().stream()
        .map(AgentResponse::from)
        .toList();
  }
}
