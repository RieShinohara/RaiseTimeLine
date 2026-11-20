package com.example.raisetimeline.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// プロフィール API の、入力と出力の形（docs/features/07-profile-follow.md）
public final class ProfileDtos {

	private ProfileDtos() {
	}

	// プロフィールの編集の入力。ユーザー名・メールは、変えられない（入れない）。
	// 前後の空白は、取ってから検査・保存する。自己紹介は、空なら null（「未設定」）にする
	public record ProfileUpdateRequest(
			@NotBlank(message = "表示名を入力してください")
			@Size(max = 50, message = "表示名は 50 文字までです")
			String displayName,

			@Size(max = 160, message = "自己紹介は 160 文字までです")
			String bio) {

		public ProfileUpdateRequest {
			displayName = displayName == null ? null : displayName.strip();
			bio = bio == null || bio.isBlank() ? null : bio.strip();
		}

	}

	// プロフィール。メールアドレスは、他の人に見せない（入れない）。
	// followedByMe：ログイン中の自分が、この人をフォローしているか（ログインなしは、常に false）
	public record ProfileResponse(Long id, String username, String displayName, String bio, long followingCount,
			long followerCount, boolean followedByMe) {
	}

}
