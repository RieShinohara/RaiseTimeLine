package com.example.raisetimeline.post;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.post.PostDtos.NewCountResponse;
import com.example.raisetimeline.post.PostDtos.PostPageResponse;
import com.example.raisetimeline.post.PostDtos.PostResponse;

@Service
public class PostService {

	static final int MAX_SIZE = 50;

	private final PostMapper postMapper;
	private final PostLikeMapper postLikeMapper;

	public PostService(PostMapper postMapper, PostLikeMapper postLikeMapper) {
		this.postMapper = postMapper;
		this.postLikeMapper = postLikeMapper;
	}

	// before：この id より古い投稿を返す（空なら最新から）。size：1〜50
	// userId：ログイン中の人（ログインなしは null）。「自分が押したか」の判断に使う
	public PostPageResponse list(Long before, int size, Long userId) {
		if (size < 1 || size > MAX_SIZE) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "size は 1〜" + MAX_SIZE + " で指定してください");
		}
		// 1 件多く読んで、続きがあるかを知る
		List<Post> rows = postMapper.findOlderThan(before, size + 1);
		boolean hasNext = rows.size() > size;
		// 【わざと素直な作り方】1 件ずつ、数と「押したか」を聞く → SQL が 1 + N + N 回になる（N+1 問題）
		List<PostResponse> posts = rows.stream().limit(size).map(post -> toResponse(post, userId)).toList();
		return new PostPageResponse(posts, hasNext);
	}

	private PostResponse toResponse(Post post, Long userId) {
		long likeCount = postLikeMapper.countByPostId(post.getId());
		boolean likedByMe = userId != null && postLikeMapper.exists(post.getId(), userId);
		return PostResponse.from(post, likeCount, likedByMe);
	}

	// after より新しい（id が大きい）投稿の件数。ログイン中なら、自分の投稿は数えない
	// （自分が投稿したときは、一番上にすぐ出るため）
	public NewCountResponse newCount(long after, Long userId) {
		if (after < 0) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "after は 0 以上で指定してください");
		}
		long count = userId == null
				? postMapper.countNewerThan(after)
				: postMapper.countNewerThanExcludingUser(after, userId);
		return new NewCountResponse(count);
	}

	public PostResponse create(Long userId, String body) {
		Post post = new Post();
		post.setUserId(userId);
		post.setBody(body);
		postMapper.insert(post);
		// できたばかりなので、いいねは 0 件
		return PostResponse.from(postMapper.findById(post.getId()), 0, false);
	}

	public PostResponse update(Long userId, Long id, String body) {
		Post post = findOwned(userId, id);
		// 本文が同じなら、更新しない（「編集済み」にしない）。
		// 更新の SQL にも本人の条件があるので、確認のあとに投稿が消されると、0 件になる → 404（B8）
		if (!body.equals(post.getBody()) && postMapper.updateBody(id, userId, body) == 0) {
			throw notFound();
		}
		Post updated = postMapper.findById(id);
		if (updated == null) {
			throw notFound();
		}
		return toResponse(updated, userId);
	}

	public void delete(Long userId, Long id) {
		findOwned(userId, id);
		// すでに消えていても（確認のあとに、ほかで消された）、結果は同じ「消えている」ので、件数は見ない
		postMapper.deleteById(id, userId);
	}

	private static ApiException notFound() {
		return new ApiException(HttpStatus.NOT_FOUND, "投稿が見つかりません");
	}

	// 編集・削除は、本人だけ。他の人の投稿は、サーバー側でも拒否する
	private Post findOwned(Long userId, Long id) {
		Post post = postMapper.findById(id);
		if (post == null) {
			throw notFound();
		}
		if (!post.getUserId().equals(userId)) {
			throw new ApiException(HttpStatus.FORBIDDEN, "他の人の投稿は、編集・削除できません");
		}
		return post;
	}

}
