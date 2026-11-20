package com.example.raisetimeline.profile;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.auth.User;
import com.example.raisetimeline.auth.UserMapper;
import com.example.raisetimeline.follow.FollowMapper;
import com.example.raisetimeline.post.PostDtos.PostPageResponse;
import com.example.raisetimeline.post.PostService;
import com.example.raisetimeline.profile.ProfileDtos.ProfileResponse;
import com.example.raisetimeline.profile.ProfileDtos.ProfileUpdateRequest;

// プロフィールの取得・編集と、そのユーザーの投稿の一覧。取得と一覧は、ログインなしでも見られる（PF-5）
@Service
public class ProfileService {

	private final UserMapper userMapper;
	private final FollowMapper followMapper;
	private final PostService postService;

	public ProfileService(UserMapper userMapper, FollowMapper followMapper, PostService postService) {
		this.userMapper = userMapper;
		this.followMapper = followMapper;
		this.postService = postService;
	}

	// viewerId：ログイン中の人（ログインなしは null）
	public ProfileResponse get(String username, Long viewerId) {
		return toResponse(requireUser(username), viewerId);
	}

	// 編集は、本人だけ。他の人のプロフィールは、サーバー側でも拒否する
	public ProfileResponse update(String username, Long viewerId, ProfileUpdateRequest request) {
		User user = requireUser(username);
		if (!user.getId().equals(viewerId)) {
			throw new ApiException(HttpStatus.FORBIDDEN, "他の人のプロフィールは、編集できません");
		}
		// 確かめたあとに、アカウントが消された場合は、0 件になる → 404
		if (userMapper.updateProfile(user.getId(), request.displayName(), request.bio()) == 0) {
			throw notFound();
		}
		User updated = userMapper.findById(user.getId());
		if (updated == null) {
			throw notFound();
		}
		return toResponse(updated, viewerId);
	}

	public PostPageResponse listPosts(String username, Long before, int size, Long viewerId) {
		User user = requireUser(username);
		return postService.listByUserId(user.getId(), before, size, viewerId);
	}

	private ProfileResponse toResponse(User user, Long viewerId) {
		boolean followedByMe = viewerId != null && followMapper.exists(viewerId, user.getId());
		return new ProfileResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getBio(),
				followMapper.countFollowing(user.getId()), followMapper.countFollowers(user.getId()), followedByMe);
	}

	private User requireUser(String username) {
		User user = userMapper.findByUsername(username);
		if (user == null) {
			throw notFound();
		}
		return user;
	}

	private static ApiException notFound() {
		return new ApiException(HttpStatus.NOT_FOUND, "ユーザーが見つかりません");
	}

}
