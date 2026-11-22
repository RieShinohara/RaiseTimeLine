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

// 「フォロー中」タイムライン API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, FollowingTimelineApiTests.CountConfig.class })
class FollowingTimelineApiTests {

	private static final String PASSWORD = "password1";

	@TestConfiguration
	static class CountConfig {

		// MyBatis は、この見張りを、自動で組み込む（SQL の回数を数える）
		@Bean
		SqlCountInterceptor sqlCountInterceptor() {
			return new SqlCountInterceptor();
		}

	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private SqlCountInterceptor counter;

	private record Member(String username, String token) {
	}

	private Member newMember() throws Exception {
		String s = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
		String username = "f_" + s;
		String email = "ftl_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"%s\",\"displayName\":\"テスト\"}"
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

	private void follow(Member who, Member target) throws Exception {
		mockMvc.perform(put("/api/users/" + target.username() + "/follow")
				.header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk());
	}

	// 投稿して、投稿の id を返す
	private long createPost(Member who, String body) throws Exception {
		String json = mockMvc.perform(post("/api/posts").header(HttpHeaders.AUTHORIZATION, bearer(who))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"" + body + "\"}"))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private String following(Member who, String query) throws Exception {
		return mockMvc.perform(get("/api/posts/following" + query).header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}

	private long newCount(Member who, long after) throws Exception {
		String json = mockMvc.perform(get("/api/posts/following/new-count?after=" + after)
				.header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.count")).longValue();
	}

	@Test
	void ログインしていないと_フォロー中の投稿も新着の件数も見られない() throws Exception {
		// 「/api/posts/{id}」（ログインなしで可）に「following」が当てはまって、通ってしまわないことの確認
		mockMvc.perform(get("/api/posts/following")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/posts/following/new-count?after=0")).andExpect(status().isUnauthorized());
	}

	@Test
	void フォローしている人の投稿だけが_新しい順に出る() throws Exception {
		Member me = newMember();
		Member a = newMember();
		Member b = newMember();
		Member stranger = newMember();
		follow(me, a);
		follow(me, b);
		// stranger は、自分（me）はフォローしていないが、a にはフォローされている。
		// 「誰かにフォローされている人の投稿」が、混ざらないことの確認（JOIN の条件が、自分のフォローに絞れているか）
		follow(a, stranger);
		long a1 = createPost(a, "Aの1件目");
		createPost(stranger, "フォローしていない人の投稿");
		long b1 = createPost(b, "Bの1件目");
		createPost(me, "自分の投稿");
		long a2 = createPost(a, "Aの2件目");

		String json = following(me, "");
		// 新しい順（id の大きい順）。フォローしていない人・自分の投稿は、入らない
		assertThat((Integer) JsonPath.read(json, "$.posts.length()")).isEqualTo(3);
		assertThat(((Number) JsonPath.read(json, "$.posts[0].id")).longValue()).isEqualTo(a2);
		assertThat(((Number) JsonPath.read(json, "$.posts[1].id")).longValue()).isEqualTo(b1);
		assertThat(((Number) JsonPath.read(json, "$.posts[2].id")).longValue()).isEqualTo(a1);
		assertThat((Boolean) JsonPath.read(json, "$.hasNext")).isFalse();
	}

	@Test
	void 誰もフォローしていないと空で_メールアドレスは含まれない() throws Exception {
		Member me = newMember();
		Member other = newMember();
		createPost(other, "誰もフォローしていない人には見えない");
		mockMvc.perform(get("/api/posts/following").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts").isEmpty())
				.andExpect(jsonPath("$.hasNext").value(false));

		follow(me, other);
		mockMvc.perform(get("/api/posts/following").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts[0].author.username").value(other.username()))
				.andExpect(jsonPath("$.posts[0].author.email").doesNotExist());
	}

	@Test
	void フォローをやめると_その人の投稿は出なくなる() throws Exception {
		Member me = newMember();
		Member a = newMember();
		follow(me, a);
		createPost(a, "やめる前の投稿");
		assertThat((Integer) JsonPath.read(following(me, ""), "$.posts.length()")).isEqualTo(1);

		mockMvc.perform(delete("/api/users/" + a.username() + "/follow")
				.header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isOk());
		assertThat((Integer) JsonPath.read(following(me, ""), "$.posts.length()")).isZero();
	}

	@Test
	void beforeとsizeで続きを読め_hasNextで続きの有無が分かる() throws Exception {
		Member me = newMember();
		Member a = newMember();
		follow(me, a);
		long p1 = createPost(a, "1件目");
		long p2 = createPost(a, "2件目");
		long p3 = createPost(a, "3件目");

		String first = following(me, "?size=2");
		assertThat(((Number) JsonPath.read(first, "$.posts[0].id")).longValue()).isEqualTo(p3);
		assertThat(((Number) JsonPath.read(first, "$.posts[1].id")).longValue()).isEqualTo(p2);
		assertThat((Boolean) JsonPath.read(first, "$.hasNext")).isTrue();

		// 続き：読んだ中で、いちばん古い id（p2）より古いもの
		String second = following(me, "?before=" + p2 + "&size=2");
		assertThat((Integer) JsonPath.read(second, "$.posts.length()")).isEqualTo(1);
		assertThat(((Number) JsonPath.read(second, "$.posts[0].id")).longValue()).isEqualTo(p1);
		assertThat((Boolean) JsonPath.read(second, "$.hasNext")).isFalse();
	}

	@Test
	void sizeが範囲外なら400() throws Exception {
		Member me = newMember();
		for (String size : new String[] { "0", "51", "-1" }) {
			mockMvc.perform(get("/api/posts/following?size=" + size).header(HttpHeaders.AUTHORIZATION, bearer(me)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").isNotEmpty());
		}
	}

	@Test
	void いいね数と押したかとコメント数が付く() throws Exception {
		Member me = newMember();
		Member a = newMember();
		follow(me, a);
		long id = createPost(a, "数の確認");
		mockMvc.perform(put("/api/posts/" + id + "/like").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/posts/" + id + "/comments").header(HttpHeaders.AUTHORIZATION, bearer(me))
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"コメント\"}"))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/posts/following").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.posts[0].likeCount").value(1))
				.andExpect(jsonPath("$.posts[0].likedByMe").value(true))
				.andExpect(jsonPath("$.posts[0].commentCount").value(1));
	}

	@Test
	void 新着の件数は_afterより新しい_フォローしている人の投稿だけ() throws Exception {
		Member me = newMember();
		Member a = newMember();
		Member stranger = newMember();
		follow(me, a);
		long base = createPost(a, "基準の投稿");
		assertThat(newCount(me, base)).isZero();

		createPost(a, "新着1");
		createPost(stranger, "フォローしていない人の新着");
		createPost(me, "自分の新着");
		createPost(a, "新着2");
		// フォローしている人の新着 2 件だけ。基準より古いもの（基準自身）は数えない
		assertThat(newCount(me, base)).isEqualTo(2);
		assertThat(newCount(me, 0)).isEqualTo(3);
	}

	@Test
	void 新着の件数のafterが不正なら400() throws Exception {
		Member me = newMember();
		mockMvc.perform(get("/api/posts/following/new-count?after=-1").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts/following/new-count").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/posts/following/new-count?after=abc").header(HttpHeaders.AUTHORIZATION, bearer(me)))
				.andExpect(status().isBadRequest());
	}

	@Test
	void フォロー中の一覧のSQLは_件数によらず4回() throws Exception {
		Member me = newMember();
		Member a = newMember();
		follow(me, a);
		for (int i = 0; i < 6; i++) {
			createPost(a, "件数の確認 " + i);
		}
		// 投稿 1 回 ＋ いいね数 1 回 ＋ 押したか 1 回 ＋ コメント数 1 回（すべてまとめて）。5 件でも 2 件でも、同じ（N+1 でない）
		counter.reset();
		following(me, "?size=5");
		assertThat(counter.selects()).isEqualTo(4);
		counter.reset();
		following(me, "?size=2");
		assertThat(counter.selects()).isEqualTo(4);
	}

}
