package com.example.raisetimeline.comment;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// comments 表の操作。SQL は resources/mapper/CommentMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface CommentMapper {

	// 投稿ごとのコメント数（まとめて数えた 1 行分。返信を含む）。0 件の投稿は、行が出てこない
	record CommentCount(Long postId, long commentCount) {
	}

	void insert(Comment comment);

	List<Comment> findByPostId(@Param("postId") Long postId);

	Comment findById(@Param("id") Long id);

	long countByPostId(@Param("postId") Long postId);

	List<CommentCount> countByPostIds(@Param("postIds") List<Long> postIds);

	int deleteById(@Param("id") Long id);

}
