package com.example.raisetimeline.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

// 投稿 API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PostApiTests {

	private static final String PASSWORD = "password1";

	@Autowired
	private MockMvc mockMvc;

	private static String suffix() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	// 登録してログインし、アクセストークンを返す
	private String loginAsNewUser() throws Exception {
		String s = suffix();
		String email = "post_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"u_%s\",\"displayName\":\"テスト\"}"
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

	private static String bodyJson(String body) {
		return "{\"body\":\"" + body + "\"}";
	}

	// 投稿して、応答の JSON を返す
	private String createPost(String token, String body) throws Exception {
		return mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson(body)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
	}

	private static Number idOf(String postJson) {
		return JsonPath.read(postJson, "$.id");
	}

	@Test
	void 投稿するとユーザー名つきで返りメールアドレスは含まれない() throws Exception {
		String token = loginAsNewUser();
		mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("はじめての投稿です")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.body").value("はじめての投稿です"))
				.andExpect(jsonPath("$.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.updatedAt").doesNotExist())
				.andExpect(jsonPath("$.author.username").isNotEmpty())
				.andExpect(jsonPath("$.author.displayName").value("テスト"))
				.andExpect(jsonPath("$.author.email").doesNotExist());
	}

	@Test
	void ログインしていないと投稿編集削除はできない() throws Exception {
		mockMvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content(bodyJson("x")))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(put("/api/posts/1").contentType(MediaType.APPLICATION_JSON).content(bodyJson("x")))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/posts/1")).andExpect(status().isUnauthorized());
	}

	@Test
	void 本文は1文字から280文字まで() throws Exception {
		String token = loginAsNewUser();
		for (String bad : new String[] { "", "   ", "あ".repeat(281) }) {
			mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON).content(bodyJson(bad)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").isNotEmpty());
		}
		createPost(token, "あ".repeat(280));
		createPost(token, "a");
	}

	@Test
	void タイムラインはログインなしで見られ新しい順に並ぶ() throws Exception {
		String token = loginAsNewUser();
		Number first = idOf(createPost(token, "古い投稿"));
		Number second = idOf(createPost(token, "新しい投稿"));
		mockMvc.perform(get("/api/posts").param("page", "0").param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts.length()").value(2))
				.andExpect(jsonPath("$.posts[0].id").value(second.intValue()))
				.andExpect(jsonPath("$.posts[1].id").value(first.intValue()))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(2));
	}

	@Test
	void ページをめくると続きが取れ最後のページではhasNextがfalse() throws Exception {
		String token = loginAsNewUser();
		createPost(token, "ページ確認 1");
		createPost(token, "ページ確認 2");
		createPost(token, "ページ確認 3");
		String page0 = mockMvc.perform(get("/api/posts").param("page", "0").param("size", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hasNext").value(true))
				.andReturn().getResponse().getContentAsString();
		String page1 = mockMvc.perform(get("/api/posts").param("page", "1").param("size", "1"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		Number id0 = JsonPath.read(page0, "$.posts[0].id");
		Number id1 = JsonPath.read(page1, "$.posts[0].id");
		assertThat(id1.longValue()).isLessThan(id0.longValue());
		// 十分に先のページは空で、続きもない
		mockMvc.perform(get("/api/posts").param("page", "100000").param("size", "50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts.length()").value(0))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void ページと件数の指定が範囲外なら400() throws Exception {
		mockMvc.perform(get("/api/posts").param("page", "-1")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts").param("size", "0")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts").param("size", "51")).andExpect(status().isBadRequest());
	}

	@Test
	void 自分の投稿を編集すると編集済みになり同じ本文なら更新しない() throws Exception {
		String token = loginAsNewUser();
		Number id = idOf(createPost(token, "直す前"));
		mockMvc.perform(put("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("直す前")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.updatedAt").doesNotExist());
		mockMvc.perform(put("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("直したあと")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.body").value("直したあと"))
				.andExpect(jsonPath("$.updatedAt").isNotEmpty());
	}

	@Test
	void 他の人の投稿は編集も削除もできず存在しない投稿は404() throws Exception {
		String owner = loginAsNewUser();
		String other = loginAsNewUser();
		Number id = idOf(createPost(owner, "本人だけ"));
		mockMvc.perform(put("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(other))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("のっとり")))
				.andExpect(status().isForbidden());
		mockMvc.perform(delete("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(other)))
				.andExpect(status().isForbidden());
		// 拒否されたので、本文は変わっていない
		mockMvc.perform(get("/api/posts").param("size", "50"))
				.andExpect(jsonPath("$.posts[?(@.id==" + id + ")].body").value("本人だけ"));
		mockMvc.perform(put("/api/posts/999999999").header(HttpHeaders.AUTHORIZATION, bearer(owner))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("x")))
				.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/posts/999999999").header(HttpHeaders.AUTHORIZATION, bearer(owner)))
				.andExpect(status().isNotFound());
	}

	@Test
	void 自分の投稿を削除すると消える() throws Exception {
		String token = loginAsNewUser();
		Number id = idOf(createPost(token, "消す投稿"));
		mockMvc.perform(delete("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/posts").param("size", "50"))
				.andExpect(jsonPath("$.posts[?(@.id==" + id + ")]").isEmpty());
		mockMvc.perform(delete("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isNotFound());
	}

	@Test
	void 新着件数は指定日時より新しい他の人の投稿だけを数える() throws Exception {
		String mine = loginAsNewUser();
		String other = loginAsNewUser();
		// サーバーが返した日時を、変換せずに、そのまま since にする（自分自身が、新着に数えられないことの確認）
		String since = JsonPath.read(createPost(mine, "基準の投稿"), "$.createdAt");
		mockMvc.perform(get("/api/posts/new-count").param("since", since))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.count").value(0));
		createPost(other, "他の人の新着");
		createPost(mine, "自分の新着");
		// ログイン中は、自分の投稿を数えない
		mockMvc.perform(get("/api/posts/new-count").param("since", since)
				.header(HttpHeaders.AUTHORIZATION, bearer(mine)))
				.andExpect(jsonPath("$.count").value(1));
		// ログインなしは、全部数える
		mockMvc.perform(get("/api/posts/new-count").param("since", since))
				.andExpect(jsonPath("$.count").value(2));
	}

	@Test
	void 新着件数のsinceがないか形が違うと400() throws Exception {
		mockMvc.perform(get("/api/posts/new-count")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts/new-count").param("since", "きのう")).andExpect(status().isBadRequest());
	}

}
