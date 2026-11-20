package com.example.raisetimeline.follow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.example.raisetimeline.TestcontainersConfiguration;
import com.example.raisetimeline.auth.UserMapper;
import com.jayway.jsonpath.JsonPath;

// フォロー API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class FollowApiTests {

	private static final String PASSWORD = "password1";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private FollowMapper followMapper;

	@Autowired
	private UserMapper userMapper;

	// 登録してログインした人の、ユーザー名・番号・札
	private record Member(String username, long id, String token) {
	}

	private Member newMember() throws Exception {
		String s = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
		String username = "f_" + s;
		String email = "follow_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"%s\",\"displayName\":\"テスト\"}"
						.formatted(email, PASSWORD, username)))
				.andExpect(status().isCreated());
		MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)))
				.andExpect(status().isOk())
				.andReturn();
		String token = JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
		return new Member(username, userMapper.findByUsername(username).getId(), token);
	}

	private static String bearer(Member m) {
		return "Bearer " + m.token();
	}

	private void follow(Member who, Member target, long followerCount) throws Exception {
		mockMvc.perform(put("/api/users/" + target.username() + "/follow")
				.header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.followerCount").value(followerCount))
				.andExpect(jsonPath("$.following").value(true));
	}

	private void unfollow(Member who, Member target, long followerCount) throws Exception {
		mockMvc.perform(delete("/api/users/" + target.username() + "/follow")
				.header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.followerCount").value(followerCount))
				.andExpect(jsonPath("$.following").value(false));
	}

	@Test
	void フォローするとフォロワー数が増える() throws Exception {
		Member a = newMember();
		Member b = newMember();

		follow(a, b, 1);
	}

	@Test
	void フォロワー数は人数で数える() throws Exception {
		Member target = newMember();
		Member a = newMember();
		Member b = newMember();

		follow(a, target, 1);
		follow(b, target, 2);
		// a が解除しても、b の分は残る
		unfollow(a, target, 1);
	}

	@Test
	void 同じ人が何回フォローしても1回分しか数えない() throws Exception {
		Member a = newMember();
		Member b = newMember();

		follow(a, b, 1);
		follow(a, b, 1);

		assertThat(followMapper.countFollowers(b.id())).isEqualTo(1);
	}

	@Test
	void フォローしていなくても解除できて結果は同じ() throws Exception {
		Member a = newMember();
		Member b = newMember();

		unfollow(a, b, 0);
		unfollow(a, b, 0);
	}

	@Test
	void 自分自身はフォローできない() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/" + a.username() + "/follow").header(HttpHeaders.AUTHORIZATION, bearer(a)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("自分自身は、フォローできません"));
		assertThat(followMapper.countFollowers(a.id())).isZero();
	}

	@Test
	void アプリの確認をすり抜けても自分自身のフォローはDBが止める() {
		// 画面や API を通さず、Mapper を直接呼ぶ（CHECK 制約の確認）
		assertThatThrownBy(() -> followMapper.insert(1L, 1L)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void ログインしていないとフォローできない() throws Exception {
		Member b = newMember();

		mockMvc.perform(put("/api/users/" + b.username() + "/follow")).andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/users/" + b.username() + "/follow")).andExpect(status().isUnauthorized());
	}

	@Test
	void 存在しないユーザーには404() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/no_such_user_xyz/follow").header(HttpHeaders.AUTHORIZATION, bearer(a)))
				.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/users/no_such_user_xyz/follow").header(HttpHeaders.AUTHORIZATION, bearer(a)))
				.andExpect(status().isNotFound());
	}

	@Test
	void ユーザー名は大文字小文字を区別しない() throws Exception {
		Member a = newMember();
		Member b = newMember();

		mockMvc.perform(put("/api/users/" + b.username().toUpperCase() + "/follow")
				.header(HttpHeaders.AUTHORIZATION, bearer(a)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.following").value(true));
	}

}
