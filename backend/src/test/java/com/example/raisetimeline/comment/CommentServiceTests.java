package com.example.raisetimeline.comment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.comment.CommentDtos.CommentRequest;
import com.example.raisetimeline.post.Post;
import com.example.raisetimeline.post.PostMapper;

// 「投稿があるか確かめる」と「コメントを入れる」の間に、投稿が消された場合。
// 以前から 404 にしていたが、テストがなかったので、B11 と同じ形で確かめる
class CommentServiceTests {

	@Test
	void createReturnsNotFoundWhenPostIsDeletedBetweenCheckAndInsert() {
		CommentMapper commentMapper = mock(CommentMapper.class);
		PostMapper postMapper = mock(PostMapper.class);
		when(postMapper.findById(1L)).thenReturn(new Post());
		doThrow(new DataIntegrityViolationException("comments の外部キー違反")).when(commentMapper)
				.insert(any(Comment.class));
		CommentService service = new CommentService(commentMapper, postMapper);

		ApiException e = catchThrowableOfType(ApiException.class,
				() -> service.create(2L, 1L, new CommentRequest("こんにちは", null)));

		assertThat(e).isNotNull();
		assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(e.getMessage()).isEqualTo("投稿が見つかりません");
	}

}
