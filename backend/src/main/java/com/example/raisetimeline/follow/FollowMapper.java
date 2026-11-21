package com.example.raisetimeline.follow;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// follows 表の操作。SQL は resources/mapper/FollowMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface FollowMapper {

	int insert(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

	int delete(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

	// フォロワー数（その人を、フォローしている人の数）
	long countFollowers(@Param("userId") Long userId);

	// フォロー数（その人が、フォローしている人の数）
	long countFollowing(@Param("userId") Long userId);

	// followerId の人は、followeeId の人を、フォローしているか
	boolean exists(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

	// 一覧の 1 行分（ユーザーの、見せてよい項目だけ。メールは入れない）
	record FollowUserRow(Long id, String username, String displayName, String bio) {
	}

	// フォロワーの一覧（userId の人を、フォローしている人）。フォローした日時の新しい順。limit 件まで
	List<FollowUserRow> findFollowers(@Param("userId") Long userId, @Param("limit") int limit);

	// フォロー中の一覧（userId の人が、フォローしている人）。フォローした日時の新しい順。limit 件まで
	List<FollowUserRow> findFollowing(@Param("userId") Long userId, @Param("limit") int limit);

	// followerId の人が、followeeIds のうち、フォローしている人の id（まとめて 1 回で）
	List<Long> findFolloweeIds(@Param("followerId") Long followerId, @Param("followeeIds") List<Long> followeeIds);

}
