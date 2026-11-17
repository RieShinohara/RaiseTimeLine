package com.example.raisetimeline.post;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

// posts 表の操作。値は必ず #{} で渡す（${} は SQL インジェクションの元なので使わない）
@Mapper
public interface PostMapper {

	@Insert("""
			INSERT INTO posts (user_id, body)
			VALUES (#{userId}, #{body})
			""")
	@Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
	void insert(Post post);

	// 新しい順（id は、投稿のたびに増える番号なので、id の大きい順＝新しい順）。投稿者の名前も、1 回の SQL で読む。
	// before が空なら最新から、あれば「id が before より小さい（古い）」ものだけ
	@Select("""
			SELECT p.id, p.user_id, p.body, p.created_at, p.updated_at, u.username, u.display_name
			FROM posts p
			JOIN users u ON u.id = p.user_id
			WHERE (#{before}::bigint IS NULL OR p.id < #{before})
			ORDER BY p.id DESC
			LIMIT #{limit}
			""")
	List<Post> findOlderThan(@Param("before") Long before, @Param("limit") int limit);

	@Select("""
			SELECT p.id, p.user_id, p.body, p.created_at, p.updated_at, u.username, u.display_name
			FROM posts p
			JOIN users u ON u.id = p.user_id
			WHERE p.id = #{id}
			""")
	Post findById(@Param("id") Long id);

	@Select("SELECT COUNT(*) FROM posts WHERE id > #{after}")
	long countNewerThan(@Param("after") long after);

	// ログイン中の人は、自分の投稿を、新着に数えない
	@Select("SELECT COUNT(*) FROM posts WHERE id > #{after} AND user_id <> #{userId}")
	long countNewerThanExcludingUser(@Param("after") long after, @Param("userId") Long userId);

	// 本人の投稿だけを更新する（user_id も条件に入れる）。確認と更新の間に、投稿が消された・持ち主が違う場合は、0 件になる（B8）
	@Update("UPDATE posts SET body = #{body}, updated_at = now() WHERE id = #{id} AND user_id = #{userId}")
	int updateBody(@Param("id") Long id, @Param("userId") Long userId, @Param("body") String body);

	@Delete("DELETE FROM posts WHERE id = #{id} AND user_id = #{userId}")
	int deleteById(@Param("id") Long id, @Param("userId") Long userId);

}
