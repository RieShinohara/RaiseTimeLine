package com.example.raisetimeline.post;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.post.PostDtos.LikeResponse;

// いいねの押す・取り消す。自分の投稿にも、できる（LIKE の決定）。何回押しても、結果は同じ
@Service
public class PostLikeService {

	private final PostMapper postMapper;
	private final PostLikeMapper postLikeMapper;

	public PostLikeService(PostMapper postMapper, PostLikeMapper postLikeMapper) {
		this.postMapper = postMapper;
		this.postLikeMapper = postLikeMapper;
	}

	public LikeResponse like(Long userId, Long postId) {
		requireExists(postId);
		postLikeMapper.insert(postId, userId);
		return current(userId, postId);
	}

	public LikeResponse unlike(Long userId, Long postId) {
		requireExists(postId);
		postLikeMapper.delete(postId, userId);
		return current(userId, postId);
	}

	private void requireExists(Long postId) {
		if (postMapper.findById(postId) == null) {
			throw new ApiException(HttpStatus.NOT_FOUND, "投稿が見つかりません");
		}
	}

	private LikeResponse current(Long userId, Long postId) {
		return new LikeResponse(postLikeMapper.countByPostId(postId), postLikeMapper.exists(postId, userId));
	}

}
