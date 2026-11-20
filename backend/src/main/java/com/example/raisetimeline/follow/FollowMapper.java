package com.example.raisetimeline.follow;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// follows 表の操作。SQL は resources/mapper/FollowMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface FollowMapper {

	int insert(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

	int delete(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

	// フォロワー数（その人を、フォローしている人の数）
	long countFollowers(@Param("userId") Long userId);

}
