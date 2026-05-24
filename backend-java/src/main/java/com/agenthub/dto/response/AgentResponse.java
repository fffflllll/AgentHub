package com.agenthub.dto.response;

import com.agenthub.model.Agent;

public record AgentResponse(String id, String identifier, String name, String roleDescription, String defaultModel) {
  public static AgentResponse from(Agent agent) {
    return new AgentResponse(
        agent.getId(),
        agent.getIdentifier(),
        agent.getName(),
        agent.getRoleDesc(),
        agent.getDefaultModel());
  }
}
