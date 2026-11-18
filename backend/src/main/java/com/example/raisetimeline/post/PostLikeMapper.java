package com.example.raisetimeline.post;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// post_likes 表の操作。値は必ず #{} で渡す
@Mapper
public interface PostLikeMapper {

	// すでに押していても、エラーにしない（ON CONFLICT DO NOTHING）。確認と追加を、1 つの SQL で行うので、
	// 同時に 2 回押されても、行は 1 つだけになる
	@Insert("""
			INSERT INTO post_likes (post_id, user_id)
			VALUES (#{postId}, #{userId})
			ON CONFLICT DO NOTHING
			""")
	int insert(@Param("postId") Long postId, @Param("userId") Long userId);

	// 押していなくても、エラーにしない（結果は同じ「押していない」）
	@Delete("DELETE FROM post_likes WHERE post_id = #{postId} AND user_id = #{userId}")
	int delete(@Param("postId") Long postId, @Param("userId") Long userId);

	@Select("SELECT COUNT(*) FROM post_likes WHERE post_id = #{postId}")
	long countByPostId(@Param("postId") Long postId);

	@Select("SELECT EXISTS (SELECT 1 FROM post_likes WHERE post_id = #{postId} AND user_id = #{userId})")
	boolean exists(@Param("postId") Long postId, @Param("userId") Long userId);

}
