package com.example.raisetimeline.auth;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// users 表の操作。値は必ず #{} で渡す（${} は SQL インジェクションの元なので使わない）
@Mapper
public interface UserMapper {

	@Insert("""
			INSERT INTO users (email, username, display_name, password_hash)
			VALUES (#{email}, #{username}, #{displayName}, #{passwordHash})
			""")
	@Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
	void insert(User user);

	@Select("SELECT * FROM users WHERE email = #{email}")
	User findByEmail(@Param("email") String email);

	@Select("SELECT * FROM users WHERE id = #{id}")
	User findById(@Param("id") Long id);

	@Select("SELECT COUNT(*) > 0 FROM users WHERE email = #{email}")
	boolean existsByEmail(@Param("email") String email);

	@Select("SELECT COUNT(*) > 0 FROM users WHERE lower(username) = lower(#{username})")
	boolean existsByUsername(@Param("username") String username);

}
