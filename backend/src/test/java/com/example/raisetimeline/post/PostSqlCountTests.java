package com.example.raisetimeline.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.example.raisetimeline.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;

// N+1 問題の確認：一覧を 1 回読むあいだに、SQL（読むもの）が何回走るかを数える
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, PostSqlCountTests.CountConfig.class })
class PostSqlCountTests {

	private static final String PASSWORD = "password1";

	@TestConfiguration
	static class CountConfig {

		// MyBatis は、この見張りを、自動で組み込む
		@Bean
		SqlCountInterceptor sqlCountInterceptor() {
			return new SqlCountInterceptor();
		}

	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private SqlCountInterceptor counter;

	private String viewerToken;

	private static String suffix() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	private String loginAsNewUser() throws Exception {
		String s = suffix();
		String email = "cnt_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"c_%s\",\"displayName\":\"テスト\"}"
						.formatted(email, PASSWORD, s)))
				.andExpect(status().isCreated());
		MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)))
				.andExpect(status().isOk())
				.andReturn();
		return JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
	}

	private static String bearer(String token) {
		return "Bearer " + token;
	}

	// 一覧が 20 件より多くなるように、投稿を 25 件作り、先頭の 3 件にいいねを付けておく
	@BeforeEach
	void prepare() throws Exception {
		String author = loginAsNewUser();
		viewerToken = loginAsNewUser();
		for (int i = 0; i < 25; i++) {
			String json = mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(author))
					.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"件数の確認 " + i + "\"}"))
					.andExpect(status().isCreated())
					.andReturn().getResponse().getContentAsString();
			if (i >= 22) {
				Number id = JsonPath.read(json, "$.id");
				mockMvc.perform(put("/api/posts/" + id + "/like").header(HttpHeaders.AUTHORIZATION, bearer(viewerToken)))
						.andExpect(status().isOk());
			}
		}
	}

	// 一覧を 1 回読み、そのあいだに走った SELECT の回数を返す
	private int selectsForList(int size, String token) throws Exception {
		counter.reset();
		var request = get("/api/posts?size=" + size);
		if (token != null) {
			request = request.header(HttpHeaders.AUTHORIZATION, bearer(token));
		}
		mockMvc.perform(request).andExpect(status().isOk());
		return counter.selects();
	}

	@Test
	void ログイン中の一覧のSQLは_件数によらず4回() throws Exception {
		// 投稿 1 回 ＋ いいね数 1 回 ＋ 押したか 1 回 ＋ コメント数 1 回（すべてまとめて）。
		// 20 件でも 5 件でも、同じ（N+1 になっていない）
		assertThat(selectsForList(20, viewerToken)).isEqualTo(4);
		assertThat(selectsForList(5, viewerToken)).isEqualTo(4);
	}

	@Test
	void ログインなしの一覧のSQLは_件数によらず3回() throws Exception {
		// 「押したか」は、ログインなしなら聞かない（常に false）
		assertThat(selectsForList(20, null)).isEqualTo(3);
		assertThat(selectsForList(5, null)).isEqualTo(3);
	}

	@Test
	void 一覧のいいね数と押したかが正しい() throws Exception {
		// 新しい順の先頭 3 件が、いいねを付けた投稿（1 件ずつ）。その次は、いいねなし
		String loggedIn = mockMvc.perform(get("/api/posts?size=5").header(HttpHeaders.AUTHORIZATION, bearer(viewerToken)))
				.andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		for (int i = 0; i < 3; i++) {
			assertThat((Integer) JsonPath.read(loggedIn, "$.posts[" + i + "].likeCount")).isEqualTo(1);
			assertThat((Boolean) JsonPath.read(loggedIn, "$.posts[" + i + "].likedByMe")).isTrue();
		}
		assertThat((Integer) JsonPath.read(loggedIn, "$.posts[3].likeCount")).isZero();
		assertThat((Boolean) JsonPath.read(loggedIn, "$.posts[3].likedByMe")).isFalse();

		// ログインなしでも数は見え、「押したか」は常に false
		String anonymous = mockMvc.perform(get("/api/posts?size=5")).andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		assertThat((Integer) JsonPath.read(anonymous, "$.posts[0].likeCount")).isEqualTo(1);
		assertThat((Boolean) JsonPath.read(anonymous, "$.posts[0].likedByMe")).isFalse();
	}

}
