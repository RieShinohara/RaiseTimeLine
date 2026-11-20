package com.example.raisetimeline.post;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// posts 表の操作。SQL は resources/mapper/PostMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface PostMapper {

	void insert(Post post);

	List<Post> findOlderThan(@Param("before") Long before, @Param("limit") int limit);

	Post findById(@Param("id") Long id);

	long countNewerThan(@Param("after") long after);

	long countNewerThanExcludingUser(@Param("after") long after, @Param("userId") Long userId);

	int updateBody(@Param("id") Long id, @Param("userId") Long userId, @Param("body") String body);

	int deleteById(@Param("id") Long id, @Param("userId") Long userId);

}
