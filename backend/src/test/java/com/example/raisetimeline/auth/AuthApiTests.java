package com.example.raisetimeline.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.example.raisetimeline.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;

// 認証 API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthApiTests {

	private static final String PASSWORD = "password1";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtService jwtService;

	@Autowired
	private RefreshTokenMapper refreshTokenMapper;

	@Autowired
	private UserMapper userMapper;

	private static String suffix() {
		return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
	}

	private static String registerJson(String email, String password, String username, String displayName) {
		return "{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"%s\",\"displayName\":\"%s\"}"
				.formatted(email, password, username, displayName);
	}

	private MvcResult postJson(String url, String json) throws Exception {
		return mockMvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();
	}

	private String register(String email, String username) throws Exception {
		return registerJson(email, PASSWORD, username, "テスト");
	}

	@Test
	void 登録するとユーザーが作られパスワードは返らない() throws Exception {
		String s = suffix();
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(registerJson("User_" + s + "@Example.com", PASSWORD, "user_" + s, "テスト 太郎")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.username").value("user_" + s))
				.andExpect(jsonPath("$.displayName").value("テスト 太郎"))
				.andExpect(jsonPath("$.email").value("user_" + s + "@example.com"))
				.andExpect(jsonPath("$.password").doesNotExist())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
		// パスワードは、そのままでは保存されない
		User saved = userMapper.findByEmail("user_" + s + "@example.com");
		assertThat(saved.getPasswordHash()).isNotEqualTo(PASSWORD).startsWith("$2");
	}

	@Test
	void 同じメールアドレスは大文字小文字を変えても登録できない() throws Exception {
		String s = suffix();
		postJson("/api/auth/register", register("dup_" + s + "@example.com", "a_" + s));
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(register("DUP_" + s + "@example.com", "b_" + s)))
				.andExpect(status().isConflict());
	}

	@Test
	void 同じユーザー名は大文字小文字を変えても登録できない() throws Exception {
		String s = suffix();
		postJson("/api/auth/register", register("c_" + s + "@example.com", "Same_" + s));
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(register("d_" + s + "@example.com", "SAME_" + s)))
				.andExpect(status().isConflict());
	}

	@Test
	void 入力の条件に合わないと400() throws Exception {
		String s = suffix();
		String[] bad = {
				registerJson("not-an-email", PASSWORD, "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", "short1", "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", "onlyletters", "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", "12345678", "u_" + s, "名前"),
				// 日本語・全角・スペース・73 文字は不可（B1。日本語は 72 バイトを超えて、500 になっていた）
				registerJson("e_" + s + "@example.com", "a1" + "あ".repeat(30), "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", "ＡＢＣ12345", "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", "pass word1", "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", "a1" + "b".repeat(71), "u_" + s, "名前"),
				registerJson("e_" + s + "@example.com", PASSWORD, "a", "名前"),
				registerJson("e_" + s + "@example.com", PASSWORD, "bad-name!", "名前"),
				registerJson("e_" + s + "@example.com", PASSWORD, "u_" + s, ""),
				registerJson("e_" + s + "@example.com", PASSWORD, "u_" + s, "あ".repeat(51)),
		};
		for (String json : bad) {
			mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").isNotEmpty());
		}
	}

	@Test
	void 登録からログイン更新ログアウトまで通る() throws Exception {
		String s = suffix();
		String email = "flow_" + s + "@example.com";
		postJson("/api/auth/register", register(email, "flow_" + s));

		MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email.toUpperCase() + "\",\"password\":\"" + PASSWORD + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.username").value("flow_" + s))
				.andExpect(jsonPath("$.user.passwordHash").doesNotExist())
				.andReturn();
		String body = login.getResponse().getContentAsString();
		String accessToken = JsonPath.read(body, "$.accessToken");
		String refreshToken = JsonPath.read(body, "$.refreshToken");
		Number userId = JsonPath.read(body, "$.user.id");
		assertThat(jwtService.parseUserId(accessToken)).contains(userId.longValue());

		// 更新：新しいアクセストークンが返る
		mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\":\"" + refreshToken + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty());

		// ログアウト：204。2 回目も 204（何度でも同じ）。そのあとは、更新できない
		for (int i = 0; i < 2; i++) {
			mockMvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON)
					.content("{\"refreshToken\":\"" + refreshToken + "\"}"))
					.andExpect(status().isNoContent());
		}
		mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\":\"" + refreshToken + "\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void ログインの失敗はどちらが違うか分からない同じ文言() throws Exception {
		String s = suffix();
		postJson("/api/auth/register", register("fail_" + s + "@example.com", "fail_" + s));
		String message = "メールアドレスかパスワードが違います";
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"fail_" + s + "@example.com\",\"password\":\"wrong-pass1\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value(message));
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"nobody_" + s + "@example.com\",\"password\":\"" + PASSWORD + "\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value(message));
	}

	@Test
	void パスワードは半角72文字ちょうどまで登録でき長すぎる入力のログインは500でなく401() throws Exception {
		String s = suffix();
		String email = "len_" + s + "@example.com";
		String max = "a1" + "b".repeat(70);
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(registerJson(email, max, "len_" + s, "名前")))
				.andExpect(status().isCreated());
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"password\":\"" + max + "\"}"))
				.andExpect(status().isOk());
		String tooLong = "a1" + "あ".repeat(30);
		mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"password\":\"" + tooLong + "\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void 期限切れや存在しないリフレッシュトークンでは更新できない() throws Exception {
		String s = suffix();
		postJson("/api/auth/register", register("exp_" + s + "@example.com", "exp_" + s));
		User user = userMapper.findByEmail("exp_" + s + "@example.com");
		RefreshToken expired = new RefreshToken();
		expired.setUserId(user.getId());
		expired.setToken(UUID.randomUUID().toString());
		expired.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));
		refreshTokenMapper.insert(expired);

		mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\":\"" + expired.getToken() + "\"}"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\":\"" + UUID.randomUUID() + "\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void 壊れたJSONは401ではなく400() throws Exception {
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{broken"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void ログインが必要なAPIは札がないと401() throws Exception {
		// 投稿の作成は、ログインが要る（タイムラインの閲覧は、ログインなしで見られる。TL-3）
		mockMvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"x\"}"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/posts").header("Authorization", "Bearer でたらめ")
				.contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"x\"}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void アクセストークンは改ざんや期限切れを受け付けない() {
		User user = new User();
		user.setId(42L);
		user.setEmail("jwt@example.com");
		String token = jwtService.createAccessToken(user);
		assertThat(jwtService.parseUserId(token)).contains(42L);
		// 署名の先頭の 1 文字を書き換える（末尾への追加は、符号化の余りで気づかれないことがある）
		int signatureStart = token.lastIndexOf('.') + 1;
		char first = token.charAt(signatureStart);
		String tampered = token.substring(0, signatureStart) + (first == 'A' ? 'B' : 'A')
				+ token.substring(signatureStart + 1);
		assertThat(jwtService.parseUserId(tampered)).isEmpty();
		assertThat(jwtService.parseUserId("")).isEmpty();

		JwtService expiredService = new JwtService("test-only-secret-test-only-secret-test-only-secret-0123", -1000);
		assertThat(jwtService.parseUserId(expiredService.createAccessToken(user))).isEmpty();
		JwtService otherKey = new JwtService("another-secret-another-secret-another-secret-9999", 900000);
		assertThat(jwtService.parseUserId(otherKey.createAccessToken(user))).isEmpty();
	}

}
