package com.example.raisetimeline.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

import com.example.raisetimeline.TestcontainersConfiguration;

// 「ユーザーを決める部品」を、自分で定義していること（B13）。
// 定義がないと、Spring が仮のユーザーとパスワードを、起動のたびに自動で作る（警告が出る）
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SecurityConfigTests {

	@Autowired
	private UserDetailsService userDetailsService;

	@Test
	void 仮のユーザーを自動で作らない() {
		assertThat(userDetailsService).isNotInstanceOf(InMemoryUserDetailsManager.class);
	}

	@Test
	void どの名前でも_見つからないとして断る() {
		// ログインは AuthService が自前で行う。この部品で、ユーザーを探すことはない
		assertThatThrownBy(() -> userDetailsService.loadUserByUsername("user"))
				.isInstanceOf(UsernameNotFoundException.class);
	}

}
