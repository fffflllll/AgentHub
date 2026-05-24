package com.agenthub.mapper;

import com.agenthub.model.Agent;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AgentMapper {
  List<Agent> findAll();
}
