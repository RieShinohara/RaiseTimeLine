package com.example.raisetimeline.auth;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// refresh_tokens 表の操作。SQL は resources/mapper/RefreshTokenMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface RefreshTokenMapper {

	void insert(RefreshToken refreshToken);

	RefreshToken findByToken(@Param("token") String token);

	int revokeByToken(@Param("token") String token);

	int revokeAllByUserId(@Param("userId") Long userId);

}
