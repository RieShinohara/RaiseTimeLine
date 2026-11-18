package com.example.raisetimeline.post;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.example.raisetimeline.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;

// いいね API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PostLikeApiTests {

	private static final String PASSWORD = "password1";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private PostLikeMapper postLikeMapper;

	private static String suffix() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	private String loginAsNewUser() throws Exception {
		String s = suffix();
		String email = "like_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"l_%s\",\"displayName\":\"テスト\"}"
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

	private long createPost(String token) throws Exception {
		String json = mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"いいねのテスト\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private void like(String token, long postId, int likeCount, boolean liked) throws Exception {
		mockMvc.perform(put("/api/posts/" + postId + "/like").header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.likeCount").value(likeCount))
				.andExpect(jsonPath("$.liked").value(liked));
	}

	private void unlike(String token, long postId, int likeCount, boolean liked) throws Exception {
		mockMvc.perform(delete("/api/posts/" + postId + "/like").header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.likeCount").value(likeCount))
				.andExpect(jsonPath("$.liked").value(liked));
	}

	@Test
	void いいねを押すと数が増え押した状態になる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();

		like(other, postId, 1, true);
	}

	@Test
	void 投稿した本人も自分の投稿にいいねできる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);

		like(author, postId, 1, true);
	}

	@Test
	void 数は人数で数え自分が押したかは本人ごとに違う() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String a = loginAsNewUser();
		String b = loginAsNewUser();

		like(a, postId, 1, true);
		like(b, postId, 2, true);
		// a が取り消しても、b の分は残る。a 自身は「押していない」
		unlike(a, postId, 1, false);
	}

	@Test
	void 同じ人が何回押しても1回分しか数えない() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();

		like(other, postId, 1, true);
		like(other, postId, 1, true);

		assertThat(postLikeMapper.countByPostId(postId)).isEqualTo(1);
	}

	@Test
	void 押していなくても取り消せて結果は同じ() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();

		unlike(other, postId, 0, false);
		unlike(other, postId, 0, false);
	}

	@Test
	void ログインしていないといいねできない() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);

		mockMvc.perform(put("/api/posts/" + postId + "/like")).andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/posts/" + postId + "/like")).andExpect(status().isUnauthorized());
	}

	@Test
	void 存在しない投稿には404() throws Exception {
		String user = loginAsNewUser();

		mockMvc.perform(put("/api/posts/999999999/like").header(HttpHeaders.AUTHORIZATION, bearer(user)))
				.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/posts/999999999/like").header(HttpHeaders.AUTHORIZATION, bearer(user)))
				.andExpect(status().isNotFound());
	}

	@Test
	void 投稿を消すと付いていたいいねも消える() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();
		like(other, postId, 1, true);

		mockMvc.perform(delete("/api/posts/" + postId).header(HttpHeaders.AUTHORIZATION, bearer(author)))
				.andExpect(status().isNoContent());

		assertThat(postLikeMapper.countByPostId(postId)).isZero();
	}

}
