package com.example.raisetimeline.auth;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
		http
				// Cookie を使わず、ヘッダーで札を送る方式なので、CSRF 対策は要らない
				.csrf(AbstractHttpConfigurer::disable)
				.cors(Customizer.withDefaults())
				// サーバーは、ログインの状態を持たない
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/api/auth/**").permitAll()
						// タイムラインと新着の件数は、ログインなしで見られる（TL-3）。投稿・編集・削除は、ログインが要る
						.requestMatchers(HttpMethod.GET, "/api/posts", "/api/posts/new-count").permitAll()
						// 投稿 1 件とコメント一覧も、ログインなしで見られる。書く・消すは、ログインが要る
						.requestMatchers(HttpMethod.GET, "/api/posts/{id}", "/api/posts/{id}/comments").permitAll()
						// プロフィールと、そのユーザーの投稿の一覧、フォロワー・フォロー中の一覧も、ログインなしで見られる（PF-5）。
						// 編集（PUT）と、フォロー・解除は、ログインが要る
						.requestMatchers(HttpMethod.GET, "/api/users/{username}", "/api/users/{username}/posts",
								"/api/users/{username}/followers", "/api/users/{username}/following").permitAll()
						.requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
						// Spring がエラーを返すときの内部の転送先。ここを閉じると、400 や 404 が 401 に化ける
						.requestMatchers("/error").permitAll()
						.anyRequest().authenticated())
				// ログインしていないときは、ログインの画面ではなく、401 を返す
				.exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
				.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
		return http.build();
	}

	// 「ユーザーを決める部品」。ログインは AuthService が自前で行い、JWT で認証するので、この部品は使わない。
	// 定義しないと、Spring が仮のユーザー（user）とランダムなパスワードを、起動のたびに自動で作り、
	// 「Using generated security password」の警告を出す（B13）。どの名前も「見つからない」として断る部品を置く
	@Bean
	UserDetailsService userDetailsService() {
		return username -> {
			throw new UsernameNotFoundException("ユーザーは、この部品では探さない（ログインは AuthService）");
		};
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	// 画面の URL だけを許可する
	@Bean
	CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.allowed-origin}") String allowedOrigin) {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(List.of(allowedOrigin));
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", config);
		return source;
	}

}
