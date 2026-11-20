package com.example.raisetimeline.follow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.auth.User;
import com.example.raisetimeline.auth.UserMapper;

// 「相手がいるか確かめる」と「フォローを入れる」の間に、相手が消えた場合。
// DB は使わず、部品（Mapper）を偽物にして、その隙間を作る
class FollowServiceTests {

	@Test
	void followReturnsNotFoundWhenUserIsDeletedBetweenCheckAndInsert() {
		UserMapper userMapper = mock(UserMapper.class);
		FollowMapper followMapper = mock(FollowMapper.class);
		User target = new User();
		target.setId(5L);
		// 確かめるときは「いる」。入れようとしたときに、外部キーが「もう、いない」と止める
		when(userMapper.findByUsername("someone")).thenReturn(target);
		when(followMapper.insert(1L, 5L)).thenThrow(new DataIntegrityViolationException("follows の外部キー違反"));
		FollowService service = new FollowService(userMapper, followMapper);

		ApiException e = catchThrowableOfType(ApiException.class, () -> service.follow(1L, "someone"));

		assertThat(e).isNotNull();
		assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(e.getMessage()).isEqualTo("ユーザーが見つかりません");
	}

}
