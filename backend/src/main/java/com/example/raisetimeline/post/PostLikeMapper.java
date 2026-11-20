package com.example.raisetimeline.post;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// post_likes 表の操作。SQL は resources/mapper/PostLikeMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface PostLikeMapper {

	// 投稿ごとのいいね数（まとめて数えた 1 行分）。いいねが 0 件の投稿は、行が出てこない
	record LikeCount(Long postId, long likeCount) {
	}

	int insert(@Param("postId") Long postId, @Param("userId") Long userId);

	int delete(@Param("postId") Long postId, @Param("userId") Long userId);

	long countByPostId(@Param("postId") Long postId);

	boolean exists(@Param("postId") Long postId, @Param("userId") Long userId);

	List<LikeCount> countByPostIds(@Param("postIds") List<Long> postIds);

	List<Long> findLikedPostIds(@Param("userId") Long userId, @Param("postIds") List<Long> postIds);

}
