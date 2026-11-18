package com.example.raisetimeline.comment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

// コメント API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CommentApiTests {

	private static final String PASSWORD = "password1";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private CommentMapper commentMapper;

	private static String suffix() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	private String loginAsNewUser() throws Exception {
		String s = suffix();
		String email = "cmt_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"m_%s\",\"displayName\":\"テスト\"}"
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
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"コメントのテスト\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private long comment(String token, long postId, String body, Long parentId) throws Exception {
		String parent = parentId == null ? "" : ",\"parentCommentId\":" + parentId;
		String json = mockMvc.perform(post("/api/posts/" + postId + "/comments")
				.header(HttpHeaders.AUTHORIZATION, bearer(token)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\":\"" + body + "\"" + parent + "}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private int deleteComment(String token, long id) throws Exception {
		return mockMvc.perform(delete("/api/comments/" + id).header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andReturn().getResponse().getStatus();
	}

	@Test
	void コメントすると一覧に古い順で出る() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();

		comment(other, postId, "一つ目", null);
		comment(other, postId, "二つ目", null);

		// ログインなしでも見られる
		mockMvc.perform(get("/api/posts/" + postId + "/comments"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.commentCount").value(2))
				.andExpect(jsonPath("$.comments[0].body").value("一つ目"))
				.andExpect(jsonPath("$.comments[1].body").value("二つ目"))
				.andExpect(jsonPath("$.comments[0].author.username").exists())
				.andExpect(jsonPath("$.comments[0].replies").isEmpty());
	}

	@Test
	void 投稿の一覧にコメント数が出る() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		long c1 = comment(author, postId, "親", null);
		comment(author, postId, "返信", c1);

		// 一番新しい投稿が、いま作った投稿（コメントが付いていない投稿は 0）
		long empty = createPost(author);
		mockMvc.perform(get("/api/posts?size=2"))
				.andExpect(jsonPath("$.posts[0].id").value(empty))
				.andExpect(jsonPath("$.posts[0].commentCount").value(0))
				.andExpect(jsonPath("$.posts[1].id").value(postId))
				.andExpect(jsonPath("$.posts[1].commentCount").value(2));
	}

	@Test
	void 投稿した本人も自分の投稿にコメントできる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);

		comment(author, postId, "自分で書く", null);
	}

	@Test
	void 返信はコメントの下に古い順で並び数に含まれる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();
		long c1 = comment(other, postId, "親", null);
		comment(author, postId, "返信1", c1);
		comment(other, postId, "返信2", c1);

		mockMvc.perform(get("/api/posts/" + postId + "/comments"))
				.andExpect(jsonPath("$.commentCount").value(3))
				.andExpect(jsonPath("$.comments.length()").value(1))
				.andExpect(jsonPath("$.comments[0].replies[0].body").value("返信1"))
				.andExpect(jsonPath("$.comments[0].replies[1].body").value("返信2"));
		mockMvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(3));
	}

	@Test
	void 返信への返信は元のコメントの返信になる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		long c1 = comment(author, postId, "親", null);
		long r1 = comment(author, postId, "返信", c1);
		comment(author, postId, "返信への返信", r1);

		mockMvc.perform(get("/api/posts/" + postId + "/comments"))
				.andExpect(jsonPath("$.comments.length()").value(1))
				.andExpect(jsonPath("$.comments[0].replies.length()").value(2))
				.andExpect(jsonPath("$.comments[0].replies[1].body").value("返信への返信"));
	}

	@Test
	void 別の投稿のコメントへの返信は400() throws Exception {
		String user = loginAsNewUser();
		long postA = createPost(user);
		long postB = createPost(user);
		long onA = comment(user, postA, "A のコメント", null);

		mockMvc.perform(post("/api/posts/" + postB + "/comments").header(HttpHeaders.AUTHORIZATION, bearer(user))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"x\",\"parentCommentId\":" + onA + "}"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/posts/" + postB + "/comments").header(HttpHeaders.AUTHORIZATION, bearer(user))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"x\",\"parentCommentId\":999999999}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 空と281文字は400で280文字はできる() throws Exception {
		String user = loginAsNewUser();
		long postId = createPost(user);
		String url = "/api/posts/" + postId + "/comments";

		for (String body : new String[] { "", "   ", "あ".repeat(281) }) {
			mockMvc.perform(post(url).header(HttpHeaders.AUTHORIZATION, bearer(user))
					.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"" + body + "\"}"))
					.andExpect(status().isBadRequest());
		}
		comment(user, postId, "あ".repeat(280), null);
	}

	@Test
	void ログインしていないとコメントも削除もできない() throws Exception {
		String user = loginAsNewUser();
		long postId = createPost(user);
		long id = comment(user, postId, "x", null);

		mockMvc.perform(post("/api/posts/" + postId + "/comments").contentType(MediaType.APPLICATION_JSON)
				.content("{\"body\":\"x\"}")).andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/comments/" + id)).andExpect(status().isUnauthorized());
	}

	@Test
	void 存在しない投稿には404() throws Exception {
		String user = loginAsNewUser();

		mockMvc.perform(get("/api/posts/999999999")).andExpect(status().isNotFound());
		mockMvc.perform(get("/api/posts/999999999/comments")).andExpect(status().isNotFound());
		mockMvc.perform(post("/api/posts/999999999/comments").header(HttpHeaders.AUTHORIZATION, bearer(user))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"x\"}"))
				.andExpect(status().isNotFound());
		assertThat(deleteComment(user, 999999999L)).isEqualTo(404);
	}

	@Test
	void 書いた人は自分のコメントを消せる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();
		long id = comment(other, postId, "消す", null);

		assertThat(deleteComment(other, id)).isEqualTo(204);
		assertThat(commentMapper.countByPostId(postId)).isZero();
	}

	@Test
	void 投稿した人は他の人のコメントを消せる() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String other = loginAsNewUser();
		long id = comment(other, postId, "消される", null);

		assertThat(deleteComment(author, id)).isEqualTo(204);
	}

	@Test
	void 無関係の人は消せず403() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		String writer = loginAsNewUser();
		long id = comment(writer, postId, "守られる", null);
		String stranger = loginAsNewUser();

		assertThat(deleteComment(stranger, id)).isEqualTo(403);
		assertThat(commentMapper.countByPostId(postId)).isEqualTo(1);
	}

	@Test
	void コメントを消すと返信も消える() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		long c1 = comment(author, postId, "親", null);
		comment(author, postId, "返信1", c1);
		comment(author, postId, "返信2", c1);
		long other = comment(author, postId, "別のコメント", null);

		assertThat(deleteComment(author, c1)).isEqualTo(204);

		mockMvc.perform(get("/api/posts/" + postId + "/comments"))
				.andExpect(jsonPath("$.commentCount").value(1))
				.andExpect(jsonPath("$.comments[0].id").value(other));
	}

	@Test
	void 返信だけを消してもコメントは残る() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		long c1 = comment(author, postId, "親", null);
		long r1 = comment(author, postId, "返信", c1);

		assertThat(deleteComment(author, r1)).isEqualTo(204);

		mockMvc.perform(get("/api/posts/" + postId + "/comments"))
				.andExpect(jsonPath("$.commentCount").value(1))
				.andExpect(jsonPath("$.comments[0].replies").isEmpty());
	}

	@Test
	void 投稿を消すとコメントも返信も消える() throws Exception {
		String author = loginAsNewUser();
		long postId = createPost(author);
		long c1 = comment(author, postId, "親", null);
		comment(author, postId, "返信", c1);

		mockMvc.perform(delete("/api/posts/" + postId).header(HttpHeaders.AUTHORIZATION, bearer(author)))
				.andExpect(status().isNoContent());

		assertThat(commentMapper.countByPostId(postId)).isZero();
	}

}
