package com.example.raisetimeline.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
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
import com.example.raisetimeline.post.SqlCountInterceptor;
import com.jayway.jsonpath.JsonPath;

// ユーザー検索 API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）。
// 他のテストの人と混ざらないよう、毎回ちがう「目印の文字」（tag）を、名前に入れて探す
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, UserSearchApiTests.CountConfig.class })
class UserSearchApiTests {

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

	// 毎回ちがう目印の文字（英小文字と数字だけ。ユーザー名にも使える）
	private static String tag() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	// jsonString：JSON の中に書く表示名（\ などは、JSON 用に直した形で渡す）
	private Member register(String username, String jsonDisplayName) throws Exception {
		String email = "srch_" + tag() + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"%s\",\"displayName\":\"%s\"}"
						.formatted(email, PASSWORD, username, jsonDisplayName)))
				.andExpect(status().isCreated());
		MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)))
				.andExpect(status().isOk())
				.andReturn();
		return new Member(username, JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken"));
	}

	private Member register(String username) throws Exception {
		return register(username, "テスト");
	}

	// 検索して、ユーザー名の一覧を返す（ログインなし）
	private List<String> searchUsernames(String q) throws Exception {
		String json = mockMvc.perform(get("/api/users").param("q", q))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.read(json, "$.users[*].username");
	}

	@Test
	void ユーザー名の一部で探せて_ほかの人は出ない() throws Exception {
		String t = tag();
		register("abc" + t + "xyz");
		register("other" + tag());

		assertThat(searchUsernames(t)).containsExactly("abc" + t + "xyz");
		// 前の一部でも、後ろの一部でも、見つかる（部分一致）
		assertThat(searchUsernames("abc" + t)).containsExactly("abc" + t + "xyz");
		assertThat(searchUsernames(t + "xyz")).containsExactly("abc" + t + "xyz");
	}

	@Test
	void 表示名の一部でも探せる_日本語も() throws Exception {
		String t = tag();
		register("name" + t, "田中" + t + "さん");
		register("noname" + tag(), "鈴木" + tag());

		assertThat(searchUsernames("中" + t)).containsExactly("name" + t);
		assertThat(searchUsernames("田中")).contains("name" + t);
	}

	@Test
	void 大文字小文字は区別しない() throws Exception {
		String t = tag();
		register("MixedCase" + t);

		assertThat(searchUsernames("mixedcase" + t)).containsExactly("MixedCase" + t);
		assertThat(searchUsernames("MIXEDCASE" + t)).containsExactly("MixedCase" + t);
	}

	@Test
	void アンダースコアは_何でも1文字ではなく_ただの文字として探す() throws Exception {
		String t = tag();
		register("a_b" + t);
		register("axb" + t);

		// そのままだと、「a_b」が「axb」にも当てはまってしまう（_ は、LIKE では「1 文字」の意味）
		assertThat(searchUsernames("a_b" + t)).containsExactly("a_b" + t);
	}

	@Test
	void パーセントは_何文字でもではなく_ただの文字として探す() throws Exception {
		String t = tag();
		register("pct1" + t, "100%" + t);
		register("pct2" + t, "100abc" + t);

		// そのままだと、「100%」が「100abc」にも当てはまってしまう（% は、LIKE では「何文字でも」の意味）
		assertThat(searchUsernames("100%" + t)).containsExactly("pct1" + t);
	}

	@Test
	void バックスラッシュも_ただの文字として探す() throws Exception {
		String t = tag();
		// 表示名 a\b + t（JSON では、\ を \\ と書く）と、ab + t
		register("bs1" + t, "a\\\\b" + t);
		register("bs2" + t, "ab" + t);

		// そのままだと、「a\b」の \ が「次の文字を、ただの文字にする」目印になって、「ab」に当てはまってしまう
		assertThat(searchUsernames("a\\b" + t)).containsExactly("bs1" + t);
	}

	@Test
	void ユーザー名の順に並ぶ_大文字小文字は無視する() throws Exception {
		String t = tag();
		register("b" + t);
		register("C" + t);
		register("a" + t);

		assertThat(searchUsernames(t)).containsExactly("a" + t, "b" + t, "C" + t);
	}

	@Test
	void sizeで件数を絞り_続きがあればhasNextがtrue() throws Exception {
		String t = tag();
		register("n1" + t);
		register("n2" + t);
		register("n3" + t);

		mockMvc.perform(get("/api/users").param("q", t).param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users.length()").value(2))
				.andExpect(jsonPath("$.users[0].username").value("n1" + t))
				.andExpect(jsonPath("$.hasNext").value(true));
		mockMvc.perform(get("/api/users").param("q", t).param("size", "3"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users.length()").value(3))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void 前後の空白は取って探す() throws Exception {
		String t = tag();
		register("trim" + t);

		// 半角・全角の空白
		assertThat(searchUsernames("  " + t + "　")).containsExactly("trim" + t);
	}

	@Test
	void 入力が空_長すぎる_sizeが範囲外なら400() throws Exception {
		mockMvc.perform(get("/api/users")).andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").isNotEmpty());
		for (String bad : new String[] { "", "   ", "　", "a".repeat(51) }) {
			mockMvc.perform(get("/api/users").param("q", bad))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").isNotEmpty());
		}
		for (String size : new String[] { "0", "51", "-1" }) {
			mockMvc.perform(get("/api/users").param("q", "a").param("size", size))
					.andExpect(status().isBadRequest());
		}
		// ちょうど 50 文字は、探せる
		mockMvc.perform(get("/api/users").param("q", "a".repeat(50))).andExpect(status().isOk());
	}

	@Test
	void 見つからないときは空の一覧() throws Exception {
		mockMvc.perform(get("/api/users").param("q", "nobody" + tag()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users").isEmpty())
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void 自分がフォローしている人だけfollowedByMeがtrue_ログインなしと自分の行はfalse() throws Exception {
		String t = tag();
		Member me = register("me" + t);
		register("followed" + t);
		register("stranger" + t);
		mockMvc.perform(put("/api/users/followed" + t + "/follow")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + me.token()))
				.andExpect(status().isOk());

		mockMvc.perform(get("/api/users").param("q", t).header(HttpHeaders.AUTHORIZATION, "Bearer " + me.token()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[?(@.username=='followed%s')].followedByMe".formatted(t)).value(true))
				.andExpect(jsonPath("$.users[?(@.username=='stranger%s')].followedByMe".formatted(t)).value(false))
				.andExpect(jsonPath("$.users[?(@.username=='me%s')].followedByMe".formatted(t)).value(false));

		// ログインなしは、すべて false
		mockMvc.perform(get("/api/users").param("q", t))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[?(@.username=='followed%s')].followedByMe".formatted(t)).value(false));
	}

	@Test
	void メールアドレスとパスワードのハッシュは出ない() throws Exception {
		String t = tag();
		register("safe" + t);

		mockMvc.perform(get("/api/users").param("q", t))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[0].username").value("safe" + t))
				.andExpect(jsonPath("$.users[0].email").doesNotExist())
				.andExpect(jsonPath("$.users[0].passwordHash").doesNotExist())
				.andExpect(jsonPath("$.users[0].password").doesNotExist());
	}

	@Test
	void SQLインジェクション風の入力は_ただの文字として探すだけ() throws Exception {
		String t = tag();
		register("inj" + t);

		// 「全員が出る」「表が消える」ような動きにならない。ただの文字として探して、見つからないだけ
		for (String evil : new String[] { "' OR 1=1 --", "'; DROP TABLE users; --", "x' OR username LIKE '%" }) {
			mockMvc.perform(get("/api/users").param("q", evil))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.users").isEmpty());
		}
		// 表は、残っている
		assertThat(searchUsernames(t)).containsExactly("inj" + t);
	}

	@Test
	void 検索のSQLは_ログイン中2回_ログインなし1回() throws Exception {
		String t = tag();
		Member me = register("cnt" + t);
		for (int i = 0; i < 3; i++) {
			register("cnt" + i + t);
		}

		// 検索 1 回 ＋ フォロー済みの確認 1 回（まとめて）。人数が増えても、同じ
		counter.reset();
		mockMvc.perform(get("/api/users").param("q", t).header(HttpHeaders.AUTHORIZATION, "Bearer " + me.token()))
				.andExpect(status().isOk());
		assertThat(counter.selects()).isEqualTo(2);

		counter.reset();
		mockMvc.perform(get("/api/users").param("q", t)).andExpect(status().isOk());
		assertThat(counter.selects()).isEqualTo(1);
	}

}
