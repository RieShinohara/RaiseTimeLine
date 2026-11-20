package com.example.raisetimeline.auth;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// users 表の操作。SQL は resources/mapper/UserMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface UserMapper {

	void insert(User user);

	User findByEmail(@Param("email") String email);

	User findById(@Param("id") Long id);

	boolean existsByEmail(@Param("email") String email);

	boolean existsByUsername(@Param("username") String username);

}
