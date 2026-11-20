package com.example.raisetimeline.profile;

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

// プロフィール API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProfileApiTests {

	private static final String PASSWORD = "password1";

	@Autowired
	private MockMvc mockMvc;

	// 登録してログインした人の、ユーザー名・札
	private record Member(String username, String token) {
	}

	private Member newMember() throws Exception {
		String s = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
		String username = "p_" + s;
		String email = "profile_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"%s\",\"displayName\":\"はじめの名前\"}"
						.formatted(email, PASSWORD, username)))
				.andExpect(status().isCreated());
		MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)))
				.andExpect(status().isOk())
				.andReturn();
		return new Member(username, JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken"));
	}

	private static String bearer(Member m) {
		return "Bearer " + m.token();
	}

	private long createPost(Member m, String body) throws Exception {
		String json = mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(m))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"%s\"}".formatted(body)))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private void follow(Member who, Member target) throws Exception {
		mockMvc.perform(put("/api/users/" + target.username() + "/follow").header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk());
	}

	private static String profileJson(String displayName, String bio) {
		return "{\"displayName\":%s,\"bio\":%s}".formatted(quote(displayName), quote(bio));
	}

	private static String quote(String s) {
		return s == null ? "null" : "\"" + s + "\"";
	}

	// ---- 取得 ----

	@Test
	void ログインなしでプロフィールを見られる() throws Exception {
		Member a = newMember();

		mockMvc.perform(get("/api/users/" + a.username()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.username").value(a.username()))
				.andExpect(jsonPath("$.displayName").value("はじめの名前"))
				.andExpect(jsonPath("$.bio").doesNotExist())
				.andExpect(jsonPath("$.followingCount").value(0))
				.andExpect(jsonPath("$.followerCount").value(0))
				.andExpect(jsonPath("$.followedByMe").value(false));
	}

	@Test
	void メールアドレスは見せない() throws Exception {
		Member a = newMember();

		mockMvc.perform(get("/api/users/" + a.username()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").doesNotExist())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void フォロー数とフォロワー数とフォロー中かが反映される() throws Exception {
		Member a = newMember();
		Member b = newMember();
		Member c = newMember();
		follow(a, b); // a → b
		follow(c, b); // c → b
		follow(b, a); // b → a

		// b：フォローしている 1 人（a）、フォローされている 2 人（a・c）
		mockMvc.perform(get("/api/users/" + b.username()).header(HttpHeaders.AUTHORIZATION, bearer(a)))
				.andExpect(jsonPath("$.followingCount").value(1))
				.andExpect(jsonPath("$.followerCount").value(2))
				.andExpect(jsonPath("$.followedByMe").value(true));
		// b を見ている人が、b をフォローしていなければ、false。ログインなしも false
		Member d = newMember();
		mockMvc.perform(get("/api/users/" + b.username()).header(HttpHeaders.AUTHORIZATION, bearer(d)))
				.andExpect(jsonPath("$.followedByMe").value(false));
		mockMvc.perform(get("/api/users/" + b.username()))
				.andExpect(jsonPath("$.followedByMe").value(false));
	}

	@Test
	void 存在しないユーザーは404() throws Exception {
		mockMvc.perform(get("/api/users/no_such_user_xyz")).andExpect(status().isNotFound());
		mockMvc.perform(get("/api/users/no_such_user_xyz/posts")).andExpect(status().isNotFound());
	}

	@Test
	void ユーザー名は大文字小文字を区別しない() throws Exception {
		Member a = newMember();

		mockMvc.perform(get("/api/users/" + a.username().toUpperCase()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.username").value(a.username()));
	}

	// ---- 編集 ----

	@Test
	void 本人は表示名と自己紹介を編集できる() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("  新しい名前  ", "  よろしくお願いします  ")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.displayName").value("新しい名前"))
				.andExpect(jsonPath("$.bio").value("よろしくお願いします"));

		// 取得し直しても、変わっている
		mockMvc.perform(get("/api/users/" + a.username()))
				.andExpect(jsonPath("$.displayName").value("新しい名前"))
				.andExpect(jsonPath("$.bio").value("よろしくお願いします"));
	}

	@Test
	void 編集してもユーザー名は変わらない() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"displayName\":\"名前\",\"bio\":null,\"username\":\"hacked_name\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.username").value(a.username()));
	}

	@Test
	void 自己紹介は空にできて空は未設定になる() throws Exception {
		Member a = newMember();
		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("名前", "ひとこと")))
				.andExpect(status().isOk());

		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("名前", "   ")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bio").doesNotExist());
	}

	@Test
	void 自己紹介は160文字までで161文字は400() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("名前", "あ".repeat(160))))
				.andExpect(status().isOk());
		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("名前", "あ".repeat(161))))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 表示名は空と51文字は400で50文字は通る() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("   ", null)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("い".repeat(51), null)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("い".repeat(50), null)))
				.andExpect(status().isOk());
	}

	@Test
	void 他の人のプロフィールは編集できず変わらない() throws Exception {
		Member a = newMember();
		Member other = newMember();

		mockMvc.perform(put("/api/users/" + a.username()).header(HttpHeaders.AUTHORIZATION, bearer(other))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("のっとり", "のっとり")))
				.andExpect(status().isForbidden());

		mockMvc.perform(get("/api/users/" + a.username()))
				.andExpect(jsonPath("$.displayName").value("はじめの名前"))
				.andExpect(jsonPath("$.bio").doesNotExist());
	}

	@Test
	void ログインしていないと編集できない() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/" + a.username()).contentType(MediaType.APPLICATION_JSON)
				.content(profileJson("名前", null)))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void 存在しないユーザーの編集は404() throws Exception {
		Member a = newMember();

		mockMvc.perform(put("/api/users/no_such_user_xyz").header(HttpHeaders.AUTHORIZATION, bearer(a))
				.contentType(MediaType.APPLICATION_JSON).content(profileJson("名前", null)))
				.andExpect(status().isNotFound());
	}

	// ---- そのユーザーの投稿の一覧 ----

	@Test
	void 投稿の一覧はそのユーザーの投稿だけで新しい順() throws Exception {
		Member a = newMember();
		Member b = newMember();
		createPost(a, "aの1つ目");
		createPost(b, "bの投稿（混ざってはいけない）");
		createPost(a, "aの2つ目");

		mockMvc.perform(get("/api/users/" + a.username() + "/posts"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts.length()").value(2))
				.andExpect(jsonPath("$.posts[0].body").value("aの2つ目"))
				.andExpect(jsonPath("$.posts[1].body").value("aの1つ目"))
				.andExpect(jsonPath("$.posts[0].author.username").value(a.username()))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void 投稿の一覧は続きを読める() throws Exception {
		Member a = newMember();
		long first = createPost(a, "1");
		long second = createPost(a, "2");
		long third = createPost(a, "3");

		// 2 件ずつ：新しい 2 件（3・2）、続きがある
		mockMvc.perform(get("/api/users/" + a.username() + "/posts").param("size", "2"))
				.andExpect(jsonPath("$.posts.length()").value(2))
				.andExpect(jsonPath("$.posts[0].id").value(third))
				.andExpect(jsonPath("$.posts[1].id").value(second))
				.andExpect(jsonPath("$.hasNext").value(true));
		// 続き：before = 2 番目より古い → 1 件（1）、もう続きはない
		mockMvc.perform(get("/api/users/" + a.username() + "/posts").param("size", "2")
				.param("before", String.valueOf(second)))
				.andExpect(jsonPath("$.posts.length()").value(1))
				.andExpect(jsonPath("$.posts[0].id").value(first))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void 投稿の一覧にもいいね数と押したかとコメント数が付く() throws Exception {
		Member a = newMember();
		Member viewer = newMember();
		long postId = createPost(a, "数の確認");
		mockMvc.perform(put("/api/posts/" + postId + "/like").header(HttpHeaders.AUTHORIZATION, bearer(viewer)))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/posts/" + postId + "/comments").header(HttpHeaders.AUTHORIZATION, bearer(viewer))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"コメント\"}"))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/users/" + a.username() + "/posts").header(HttpHeaders.AUTHORIZATION, bearer(viewer)))
				.andExpect(jsonPath("$.posts[0].likeCount").value(1))
				.andExpect(jsonPath("$.posts[0].likedByMe").value(true))
				.andExpect(jsonPath("$.posts[0].commentCount").value(1));
		// ログインなしでは、押したかは false
		mockMvc.perform(get("/api/users/" + a.username() + "/posts"))
				.andExpect(jsonPath("$.posts[0].likedByMe").value(false));
	}

	@Test
	void 投稿が1件もないユーザーは空の一覧() throws Exception {
		Member a = newMember();

		mockMvc.perform(get("/api/users/" + a.username() + "/posts"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts.length()").value(0))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void sizeが範囲外なら400() throws Exception {
		Member a = newMember();

		mockMvc.perform(get("/api/users/" + a.username() + "/posts").param("size", "0"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/users/" + a.username() + "/posts").param("size", "51"))
				.andExpect(status().isBadRequest());
	}

}
