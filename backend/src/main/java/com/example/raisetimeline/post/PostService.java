package com.example.raisetimeline.post;

import java.time.Instant;
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

	public PostService(PostMapper postMapper) {
		this.postMapper = postMapper;
	}

	public PostPageResponse list(int page, int size) {
		if (page < 0 || size < 1 || size > MAX_SIZE) {
			throw new ApiException(HttpStatus.BAD_REQUEST,
					"page は 0 以上、size は 1〜" + MAX_SIZE + " で指定してください");
		}
		// 1 件多く読んで、続きがあるかを知る
		List<Post> rows = postMapper.findPage(size + 1, (long) page * size);
		boolean hasNext = rows.size() > size;
		List<PostResponse> posts = rows.stream().limit(size).map(PostResponse::from).toList();
		return new PostPageResponse(posts, page, size, hasNext);
	}

	// ログイン中なら、自分の投稿は数えない（自分が投稿したときは、一番上にすぐ出るため）
	public NewCountResponse newCount(Instant since, Long userId) {
		long count = userId == null
				? postMapper.countNewSince(since)
				: postMapper.countNewSinceExcludingUser(since, userId);
		return new NewCountResponse(count);
	}

	public PostResponse create(Long userId, String body) {
		Post post = new Post();
		post.setUserId(userId);
		post.setBody(body);
		postMapper.insert(post);
		return PostResponse.from(postMapper.findById(post.getId()));
	}

	public PostResponse update(Long userId, Long id, String body) {
		Post post = findOwned(userId, id);
		// 本文が同じなら、更新しない（「編集済み」にしない）
		if (!body.equals(post.getBody())) {
			postMapper.updateBody(id, body);
		}
		return PostResponse.from(postMapper.findById(id));
	}

	public void delete(Long userId, Long id) {
		findOwned(userId, id);
		postMapper.deleteById(id);
	}

	// 編集・削除は、本人だけ。他の人の投稿は、サーバー側でも拒否する
	private Post findOwned(Long userId, Long id) {
		Post post = postMapper.findById(id);
		if (post == null) {
			throw new ApiException(HttpStatus.NOT_FOUND, "投稿が見つかりません");
		}
		if (!post.getUserId().equals(userId)) {
			throw new ApiException(HttpStatus.FORBIDDEN, "他の人の投稿は、編集・削除できません");
		}
		return post;
	}

}
