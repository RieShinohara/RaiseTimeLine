package com.example.raisetimeline.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// 認証 API の、入力と出力の形（docs/features/01-auth.md 3.5・3.6）
public final class AuthDtos {

	private AuthDtos() {
	}

	public record RegisterRequest(
			@NotBlank(message = "メールアドレスを入力してください")
			@Email(message = "メールアドレスの形が正しくありません")
			@Size(max = 255, message = "メールアドレスは 255 文字までです")
			String email,

			@NotBlank(message = "パスワードを入力してください")
			@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$",
					message = "パスワードは 8〜72 文字で、英字と数字を 1 文字以上ずつ含めてください")
			String password,

			@NotBlank(message = "ユーザー名を入力してください")
			@Pattern(regexp = "^[A-Za-z0-9_]{2,30}$",
					message = "ユーザー名は 2〜30 文字の、英数字とアンダースコアだけです")
			String username,

			@NotBlank(message = "表示名を入力してください")
			@Size(max = 50, message = "表示名は 50 文字までです")
			String displayName) {
	}

	public record LoginRequest(
			@NotBlank(message = "メールアドレスを入力してください") String email,
			@NotBlank(message = "パスワードを入力してください") String password) {
	}

	public record RefreshRequest(@NotBlank(message = "リフレッシュトークンがありません") String refreshToken) {
	}

	// 画面に返すユーザー情報。パスワード（ハッシュを含む）は入れない
	public record UserResponse(Long id, String email, String username, String displayName) {

		static UserResponse from(User user) {
			return new UserResponse(user.getId(), user.getEmail(), user.getUsername(), user.getDisplayName());
		}

	}

	public record LoginResponse(String accessToken, String refreshToken, UserResponse user) {
	}

	public record AccessTokenResponse(String accessToken) {
	}

}
