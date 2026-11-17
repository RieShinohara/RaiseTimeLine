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

	@Autowired
	private PostMapper postMapper;

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
	void 本文の前後の空白は取って保存され空白だけは400() throws Exception {
		String token = loginAsNewUser();
		// 半角・全角の空白と改行を取る。途中の空白・改行は、そのまま
		mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("  \\n　前後に空白\\n途中の改行は残る  \\n")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.body").value("前後に空白\n途中の改行は残る"));
		// 取ったあとで 280 文字なら通る（前後の空白は、文字数に数えない）
		mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("  " + "あ".repeat(280) + "  ")))
				.andExpect(status().isCreated());
		// 空白だけは、取ると空になるので 400
		mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("　 \\n ")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 前後の空白だけが違う編集は変更とみなさず編集済みにしない() throws Exception {
		String token = loginAsNewUser();
		Number id = idOf(createPost(token, "そのまま"));
		mockMvc.perform(put("/api/posts/" + id).header(HttpHeaders.AUTHORIZATION, bearer(token))
				.contentType(MediaType.APPLICATION_JSON).content(bodyJson("  そのまま  ")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.body").value("そのまま"))
				.andExpect(jsonPath("$.updatedAt").doesNotExist());
	}

	@Test
	void 更新と削除のSQLは本人の投稿だけを対象にし持ち主が違えば0件() throws Exception {
		String owner = loginAsNewUser();
		Number id = idOf(createPost(owner, "持ち主の投稿"));
		Long otherUserId = Long.MAX_VALUE;
		// 確認のあとに、持ち主が違う・投稿がない状態になっても、0 件になるだけで、何も変えない（B8）
		assertThat(postMapper.updateBody(id.longValue(), otherUserId, "のっとり")).isZero();
		assertThat(postMapper.deleteById(id.longValue(), otherUserId)).isZero();
		assertThat(postMapper.findById(id.longValue()).getBody()).isEqualTo("持ち主の投稿");
		assertThat(postMapper.updateBody(999_999_999L, otherUserId, "x")).isZero();
	}

	@Test
	void タイムラインはログインなしで見られ新しい順に並ぶ() throws Exception {
		String token = loginAsNewUser();
		Number first = idOf(createPost(token, "古い投稿"));
		Number second = idOf(createPost(token, "新しい投稿"));
		mockMvc.perform(get("/api/posts").param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts.length()").value(2))
				.andExpect(jsonPath("$.posts[0].id").value(second.intValue()))
				.andExpect(jsonPath("$.posts[1].id").value(first.intValue()));
	}

	@Test
	void beforeを渡すとそれより古い投稿だけが取れ最後ではhasNextがfalse() throws Exception {
		String token = loginAsNewUser();
		createPost(token, "続き確認 1");
		createPost(token, "続き確認 2");
		createPost(token, "続き確認 3");
		String first = mockMvc.perform(get("/api/posts").param("size", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hasNext").value(true))
				.andReturn().getResponse().getContentAsString();
		Number id0 = JsonPath.read(first, "$.posts[0].id");
		String second = mockMvc.perform(get("/api/posts").param("before", id0.toString()).param("size", "1"))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		Number id1 = JsonPath.read(second, "$.posts[0].id");
		assertThat(id1.longValue()).isLessThan(id0.longValue());
		// いちばん古い id より前は、空で、続きもない
		mockMvc.perform(get("/api/posts").param("before", "1").param("size", "50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts.length()").value(0))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void 読んでいる途中で新しい投稿や削除があっても重複も取りこぼしもない() throws Exception {
		String token = loginAsNewUser();
		Number oldest = idOf(createPost(token, "途中 1"));
		Number middle = idOf(createPost(token, "途中 2"));
		Number newest = idOf(createPost(token, "途中 3"));
		String page = mockMvc.perform(get("/api/posts").param("size", "1"))
				.andReturn().getResponse().getContentAsString();
		assertThat(((Number) JsonPath.read(page, "$.posts[0].id")).longValue()).isEqualTo(newest.longValue());
		// 1 ページ目を読んだあとに、新しい投稿が入り、すでに読んだ投稿が消えても、続きは、ずれない
		createPost(token, "途中 4（読んだあとに入った）");
		mockMvc.perform(delete("/api/posts/" + newest).header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/posts").param("before", newest.toString()).param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts[0].id").value(middle.intValue()))
				.andExpect(jsonPath("$.posts[1].id").value(oldest.intValue()));
	}

	@Test
	void 件数の指定が範囲外ならまたはbeforeが数字でなければ400() throws Exception {
		mockMvc.perform(get("/api/posts").param("size", "0")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts").param("size", "51")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts").param("before", "きのう")).andExpect(status().isBadRequest());
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
	void 新着件数は指定idより新しい他の人の投稿だけを数える() throws Exception {
		String mine = loginAsNewUser();
		String other = loginAsNewUser();
		// 基準の投稿の id（自分自身が、新着に数えられないことの確認）
		String after = idOf(createPost(mine, "基準の投稿")).toString();
		mockMvc.perform(get("/api/posts/new-count").param("after", after))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.count").value(0));
		createPost(other, "他の人の新着");
		createPost(mine, "自分の新着");
		// ログイン中は、自分の投稿を数えない
		mockMvc.perform(get("/api/posts/new-count").param("after", after)
				.header(HttpHeaders.AUTHORIZATION, bearer(mine)))
				.andExpect(jsonPath("$.count").value(1));
		// ログインなしは、全部数える
		mockMvc.perform(get("/api/posts/new-count").param("after", after))
				.andExpect(jsonPath("$.count").value(2));
	}

	@Test
	void 新着件数のafterがないか負の数か数字でないと400() throws Exception {
		mockMvc.perform(get("/api/posts/new-count")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts/new-count").param("after", "-1")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts/new-count").param("after", "きのう")).andExpect(status().isBadRequest());
	}

}
