package com.agenthub.mapper;

import com.agenthub.model.UserProvider;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserProviderMapper {
  List<UserProvider> findByUserId(@Param("userId") String userId);

  UserProvider findByIdAndUserId(@Param("id") String id, @Param("userId") String userId);

  UserProvider findFirstByUserId(@Param("userId") String userId);

  int countByUserId(@Param("userId") String userId);

  int insert(UserProvider provider);

  int update(UserProvider provider);

  int deleteByIdAndUserId(@Param("id") String id, @Param("userId") String userId);

  int clearDefaults(@Param("userId") String userId);

  int markDefault(@Param("id") String id, @Param("userId") String userId);
}
