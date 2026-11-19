package com.example.raisetimeline.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import com.example.raisetimeline.auth.ApiException;

// 「投稿があるか確かめる」と「いいねを入れる」の間に、投稿が消された場合（B11）。
// DB は使わず、部品（Mapper）を偽物にして、その隙間を作る
class PostLikeServiceTests {

	@Test
	void likeReturnsNotFoundWhenPostIsDeletedBetweenCheckAndInsert() {
		PostMapper postMapper = mock(PostMapper.class);
		PostLikeMapper postLikeMapper = mock(PostLikeMapper.class);
		// 確かめるときは「ある」。入れようとしたときに、外部キーが「もう、ない」と止める
		when(postMapper.findById(1L)).thenReturn(new Post());
		when(postLikeMapper.insert(1L, 2L)).thenThrow(new DataIntegrityViolationException("post_likes の外部キー違反"));
		PostLikeService service = new PostLikeService(postMapper, postLikeMapper);

		ApiException e = catchThrowableOfType(ApiException.class, () -> service.like(2L, 1L));

		assertThat(e).isNotNull();
		assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(e.getMessage()).isEqualTo("投稿が見つかりません");
	}

}
