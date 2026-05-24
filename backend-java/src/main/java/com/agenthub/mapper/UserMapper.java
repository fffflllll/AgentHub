package com.agenthub.mapper;

import com.agenthub.model.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
  int insert(User user);

  User findByUsername(@Param("username") String username);

  User findById(@Param("id") String id);

  int update(User user);
}
