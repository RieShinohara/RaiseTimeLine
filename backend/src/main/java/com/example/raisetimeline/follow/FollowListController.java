package com.example.raisetimeline.follow;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.follow.FollowDtos.FollowUserPageResponse;

// フォロワー・フォロー中の一覧。ログインなしで見られる（SecurityConfig で許可。PF-5）
// @AuthenticationPrincipal Long userId は、アクセストークンの持ち主の ID。ログインしていなければ null
@RestController
@RequestMapping("/api/users/{username}")
public class FollowListController {

	private final FollowService followService;

	public FollowListController(FollowService followService) {
		this.followService = followService;
	}

	// そのユーザーを、フォローしている人
	@GetMapping("/followers")
	public FollowUserPageResponse followers(@PathVariable String username,
			@RequestParam(defaultValue = "50") int size, @AuthenticationPrincipal Long userId) {
		return followService.listFollowers(username, size, userId);
	}

	// そのユーザーが、フォローしている人
	@GetMapping("/following")
	public FollowUserPageResponse following(@PathVariable String username,
			@RequestParam(defaultValue = "50") int size, @AuthenticationPrincipal Long userId) {
		return followService.listFollowing(username, size, userId);
	}

}
