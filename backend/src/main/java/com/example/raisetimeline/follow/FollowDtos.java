package com.example.raisetimeline.follow;

import java.util.List;

public final class FollowDtos {

	private FollowDtos() {
	}

	// フォロー・解除の結果。followerCount は「相手のフォロワー数」、following は「いま、フォローしているか」
	public record FollowResponse(long followerCount, boolean following) {
	}

	// 一覧の 1 人分。メールアドレスは、入れない。followedByMe：ログイン中の自分が、この人をフォローしているか
	// （ログインなしは false。自分自身の行も false）
	public record FollowUserResponse(Long id, String username, String displayName, String bio,
			boolean followedByMe) {
	}

	// 一覧。hasNext：size 件より先に、まだいるか
	public record FollowUserPageResponse(List<FollowUserResponse> users, boolean hasNext) {
	}

}
