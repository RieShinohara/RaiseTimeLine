package com.example.raisetimeline.search;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.follow.FollowDtos.FollowUserPageResponse;

// ユーザー検索。ログインなしで使える（SecurityConfig で許可。AUTH-6）
// @AuthenticationPrincipal Long userId は、アクセストークンの持ち主の ID。ログインしていなければ null
@RestController
@RequestMapping("/api/users")
public class UserSearchController {

	private final UserSearchService userSearchService;

	public UserSearchController(UserSearchService userSearchService) {
		this.userSearchService = userSearchService;
	}

	// /api/users?q=山田：ユーザー名か表示名に「山田」を含む人。q が空のときは、サービスが 400 にする
	@GetMapping
	public FollowUserPageResponse search(@RequestParam(defaultValue = "") String q,
			@RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal Long userId) {
		return userSearchService.search(q, size, userId);
	}

}
