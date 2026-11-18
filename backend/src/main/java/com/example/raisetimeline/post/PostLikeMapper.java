package com.example.raisetimeline.post;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// post_likes 表の操作。値は必ず #{} で渡す
@Mapper
public interface PostLikeMapper {

	// 投稿ごとのいいね数（まとめて数えた 1 行分）。いいねが 0 件の投稿は、行が出てこない
	record LikeCount(Long postId, long likeCount) {
	}

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

	// 一覧用：投稿の id の一覧を渡して、いいね数を、まとめて 1 回で数える（N+1 を避ける）。
	// postIds は、空にしない（IN () は、SQL の間違いになる）。呼ぶ側で確かめる
	@Select("""
			<script>
			SELECT post_id AS postId, COUNT(*) AS likeCount
			FROM post_likes
			WHERE post_id IN
			<foreach collection="postIds" item="id" open="(" separator="," close=")">#{id}</foreach>
			GROUP BY post_id
			</script>
			""")
	List<LikeCount> countByPostIds(@Param("postIds") List<Long> postIds);

	// 一覧用：その人が押した投稿の id を、まとめて 1 回で調べる
	@Select("""
			<script>
			SELECT post_id
			FROM post_likes
			WHERE user_id = #{userId} AND post_id IN
			<foreach collection="postIds" item="id" open="(" separator="," close=")">#{id}</foreach>
			</script>
			""")
	List<Long> findLikedPostIds(@Param("userId") Long userId, @Param("postIds") List<Long> postIds);

}
