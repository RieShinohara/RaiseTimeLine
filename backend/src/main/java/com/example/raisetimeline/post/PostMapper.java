package com.example.raisetimeline.post;

import java.time.Instant;
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

	// 新しい順。同じ日時のときは、ID の大きい（あとに作られた）順。投稿者の名前も、1 回の SQL で読む
	@Select("""
			SELECT p.id, p.user_id, p.body, p.created_at, p.updated_at, u.username, u.display_name
			FROM posts p
			JOIN users u ON u.id = p.user_id
			ORDER BY p.created_at DESC, p.id DESC
			LIMIT #{limit} OFFSET #{offset}
			""")
	List<Post> findPage(@Param("limit") int limit, @Param("offset") long offset);

	@Select("""
			SELECT p.id, p.user_id, p.body, p.created_at, p.updated_at, u.username, u.display_name
			FROM posts p
			JOIN users u ON u.id = p.user_id
			WHERE p.id = #{id}
			""")
	Post findById(@Param("id") Long id);

	@Select("SELECT COUNT(*) FROM posts WHERE created_at > #{since}")
	long countNewSince(@Param("since") Instant since);

	// ログイン中の人は、自分の投稿を、新着に数えない
	@Select("SELECT COUNT(*) FROM posts WHERE created_at > #{since} AND user_id <> #{userId}")
	long countNewSinceExcludingUser(@Param("since") Instant since, @Param("userId") Long userId);

	@Update("UPDATE posts SET body = #{body}, updated_at = now() WHERE id = #{id}")
	int updateBody(@Param("id") Long id, @Param("body") String body);

	@Delete("DELETE FROM posts WHERE id = #{id}")
	int deleteById(@Param("id") Long id);

}
