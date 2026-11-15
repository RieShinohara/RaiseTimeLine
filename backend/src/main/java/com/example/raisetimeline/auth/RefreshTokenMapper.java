package com.example.raisetimeline.auth;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

// refresh_tokens 表の操作
@Mapper
public interface RefreshTokenMapper {

	@Insert("""
			INSERT INTO refresh_tokens (user_id, token, expires_at)
			VALUES (#{userId}, #{token}, #{expiresAt})
			""")
	@Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
	void insert(RefreshToken refreshToken);

	@Select("SELECT * FROM refresh_tokens WHERE token = #{token}")
	RefreshToken findByToken(@Param("token") String token);

	@Update("UPDATE refresh_tokens SET revoked = TRUE WHERE token = #{token}")
	int revokeByToken(@Param("token") String token);

	@Update("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = #{userId}")
	int revokeAllByUserId(@Param("userId") Long userId);

}
