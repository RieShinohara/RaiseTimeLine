package com.example.raisetimeline.follow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import com.example.raisetimeline.auth.UserMapper;
import com.example.raisetimeline.post.SqlCountInterceptor;
import com.jayway.jsonpath.JsonPath;

// フォロワー・フォロー中の一覧 API の通しのテスト（使い捨ての PostgreSQL。サンプルは、すべて架空）
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, FollowListApiTests.CountConfig.class })
class FollowListApiTests {

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
	private UserMapper userMapper;

	@Autowired
	private SqlCountInterceptor counter;

	private record Member(String username, String token) {
	}

	private Member newMember() throws Exception {
		String s = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
		String username = "l_" + s;
		String email = "flist_" + s + "@example.com";
		mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\",\"username\":\"%s\",\"displayName\":\"テスト\"}"
						.formatted(email, PASSWORD, username)))
				.andExpect(status().isCreated());
		MvcResult login = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)))
				.andExpect(status().isOk())
				.andReturn();
		String token = JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
		assertThat(userMapper.findByUsername(username)).isNotNull();
		return new Member(username, token);
	}

	private static String bearer(Member m) {
		return "Bearer " + m.token();
	}

	private void follow(Member who, Member target) throws Exception {
		mockMvc.perform(put("/api/users/" + target.username() + "/follow")
				.header(HttpHeaders.AUTHORIZATION, bearer(who)))
				.andExpect(status().isOk());
	}

	@Test
	void フォロワーの一覧は_フォローした順の新しい順で_ログインなしでも見られる() throws Exception {
		Member target = newMember();
		Member a = newMember();
		Member b = newMember();
		Member c = newMember();
		follow(a, target);
		follow(b, target);
		follow(c, target);

		mockMvc.perform(get("/api/users/" + target.username() + "/followers"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users", hasSize(3)))
				.andExpect(jsonPath("$.users[0].username").value(c.username()))
				.andExpect(jsonPath("$.users[1].username").value(b.username()))
				.andExpect(jsonPath("$.users[2].username").value(a.username()))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void フォロー中の一覧は_その人がフォローしている人だけが出る() throws Exception {
		Member me = newMember();
		Member a = newMember();
		Member b = newMember();
		Member stranger = newMember();
		follow(me, a);
		follow(me, b);
		follow(stranger, me);

		mockMvc.perform(get("/api/users/" + me.username() + "/following"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users", hasSize(2)))
				.andExpect(jsonPath("$.users[0].username").value(b.username()))
				.andExpect(jsonPath("$.users[1].username").value(a.username()));
	}

	@Test
	void followedByMeは_ログインなしと自分自身はfalse_フォロー済みの人だけtrue() throws Exception {
		Member target = newMember();
		Member viewer = newMember();
		Member other = newMember();
		follow(viewer, target);
		follow(other, target);
		follow(viewer, other);

		// viewer 本人から見ると：viewer 自身は false、フォローしている other は true
		mockMvc.perform(get("/api/users/" + target.username() + "/followers")
				.header(HttpHeaders.AUTHORIZATION, bearer(viewer)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[?(@.username=='%s')].followedByMe".formatted(viewer.username()))
						.value(false))
				.andExpect(jsonPath("$.users[?(@.username=='%s')].followedByMe".formatted(other.username()))
						.value(true));

		// ログインなしは、すべて false
		mockMvc.perform(get("/api/users/" + target.username() + "/followers"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[0].followedByMe").value(false))
				.andExpect(jsonPath("$.users[1].followedByMe").value(false));
	}

	@Test
	void 存在しないユーザーは404() throws Exception {
		mockMvc.perform(get("/api/users/nobody_zzzz_404/followers")).andExpect(status().isNotFound());
		mockMvc.perform(get("/api/users/nobody_zzzz_404/following")).andExpect(status().isNotFound());
	}

	@Test
	void sizeが範囲外なら400() throws Exception {
		Member target = newMember();
		mockMvc.perform(get("/api/users/" + target.username() + "/followers?size=0"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/users/" + target.username() + "/followers?size=51"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/users/" + target.username() + "/following?size=51"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/users/" + target.username() + "/following?size=50"))
				.andExpect(status().isOk());
	}

	@Test
	void sizeより多いときは_size件だけ返してhasNextがtrue() throws Exception {
		Member target = newMember();
		Member a = newMember();
		Member b = newMember();
		Member c = newMember();
		follow(a, target);
		follow(b, target);
		follow(c, target);

		mockMvc.perform(get("/api/users/" + target.username() + "/followers?size=2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users", hasSize(2)))
				.andExpect(jsonPath("$.hasNext").value(true));
		// ちょうど 3 件のとき、size=3 は、続きなし
		mockMvc.perform(get("/api/users/" + target.username() + "/followers?size=3"))
				.andExpect(jsonPath("$.users", hasSize(3)))
				.andExpect(jsonPath("$.hasNext").value(false));
	}

	@Test
	void 一覧の応答に_メールとパスワードは含まれない() throws Exception {
		Member target = newMember();
		Member a = newMember();
		follow(a, target);

		mockMvc.perform(get("/api/users/" + target.username() + "/followers"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[0].email").doesNotExist())
				.andExpect(jsonPath("$.users[0].passwordHash").doesNotExist())
				.andExpect(content().string(not(containsString("@example.com"))));
	}

	@Test
	void 一覧のSQLは_人数によらず同じ回数() throws Exception {
		Member target = newMember();
		Member viewer = newMember();
		for (int i = 0; i < 6; i++) {
			follow(newMember(), target);
		}

		// ログイン中：ユーザー 1 回 ＋ 一覧 1 回 ＋ 「フォロー済みか」1 回（まとめて）。2 人でも 6 人でも同じ
		assertThat(selects("/api/users/" + target.username() + "/followers?size=2", viewer)).isEqualTo(3);
		assertThat(selects("/api/users/" + target.username() + "/followers?size=6", viewer)).isEqualTo(3);
		// ログインなしは、「フォロー済みか」を聞かない
		assertThat(selects("/api/users/" + target.username() + "/followers?size=6", null)).isEqualTo(2);
	}

	// 一覧を 1 回読み、そのあいだに走った SELECT の回数を返す
	private int selects(String url, Member viewer) throws Exception {
		counter.reset();
		var request = get(url);
		if (viewer != null) {
			request = request.header(HttpHeaders.AUTHORIZATION, bearer(viewer));
		}
		mockMvc.perform(request).andExpect(status().isOk());
		return counter.selects();
	}

}
