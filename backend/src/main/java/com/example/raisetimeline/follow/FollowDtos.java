package com.example.raisetimeline.follow;

public final class FollowDtos {

	private FollowDtos() {
	}

	// フォロー・解除の結果。followerCount は「相手のフォロワー数」、following は「いま、フォローしているか」
	public record FollowResponse(long followerCount, boolean following) {
	}

}
