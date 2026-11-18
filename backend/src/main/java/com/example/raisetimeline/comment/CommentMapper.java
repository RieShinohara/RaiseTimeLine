package com.example.raisetimeline.comment;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// comments 表の操作。値は必ず #{} で渡す
@Mapper
public interface CommentMapper {

	// 投稿ごとのコメント数（まとめて数えた 1 行分。返信を含む）。0 件の投稿は、行が出てこない
	record CommentCount(Long postId, long commentCount) {
	}

	@Insert("""
			INSERT INTO comments (post_id, user_id, parent_comment_id, body)
			VALUES (#{postId}, #{userId}, #{parentCommentId}, #{body})
			""")
	@Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
	void insert(Comment comment);

	// 古い順（id は増える番号なので、id の小さい順＝古い順）。コメントした人の名前も、1 回の SQL で読む。
	// コメントと返信を、まとめて読む（入れ子にするのは Service）
	@Select("""
			SELECT c.id, c.post_id, c.user_id, c.parent_comment_id, c.body, c.created_at, u.username, u.display_name
			FROM comments c
			JOIN users u ON u.id = c.user_id
			WHERE c.post_id = #{postId}
			ORDER BY c.id
			""")
	List<Comment> findByPostId(@Param("postId") Long postId);

	@Select("""
			SELECT c.id, c.post_id, c.user_id, c.parent_comment_id, c.body, c.created_at, u.username, u.display_name
			FROM comments c
			JOIN users u ON u.id = c.user_id
			WHERE c.id = #{id}
			""")
	Comment findById(@Param("id") Long id);

	@Select("SELECT COUNT(*) FROM comments WHERE post_id = #{postId}")
	long countByPostId(@Param("postId") Long postId);

	// 一覧用：投稿の id の一覧を渡して、コメント数を、まとめて 1 回で数える（N+1 を避ける）。
	// postIds は、空にしない（IN () は、SQL の間違いになる）。呼ぶ側で確かめる
	@Select("""
			<script>
			SELECT post_id AS postId, COUNT(*) AS commentCount
			FROM comments
			WHERE post_id IN
			<foreach collection="postIds" item="id" open="(" separator="," close=")">#{id}</foreach>
			GROUP BY post_id
			</script>
			""")
	List<CommentCount> countByPostIds(@Param("postIds") List<Long> postIds);

	// 返信は、DB の ON DELETE CASCADE で、一緒に消える
	@Delete("DELETE FROM comments WHERE id = #{id}")
	int deleteById(@Param("id") Long id);

}
