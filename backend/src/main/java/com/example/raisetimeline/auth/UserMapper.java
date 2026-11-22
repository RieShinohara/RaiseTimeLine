package com.example.raisetimeline.auth;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

// users 表の操作。SQL は resources/mapper/UserMapper.xml に書く（メソッド名 ＝ XML の id）
@Mapper
public interface UserMapper {

	void insert(User user);

	User findByEmail(@Param("email") String email);

	User findById(@Param("id") Long id);

	User findByUsername(@Param("username") String username);

	int updateProfile(@Param("id") Long id, @Param("displayName") String displayName, @Param("bio") String bio);

	// 検索結果の 1 行分（ユーザーの、見せてよい項目だけ。メールは入れない）
	record UserSearchRow(Long id, String username, String displayName, String bio) {
	}

	// ユーザー検索。pattern は LIKE の形（呼ぶ側が、%入力% にして、\ % _ をエスケープ済み）。ユーザー名の順に、limit 件まで
	List<UserSearchRow> search(@Param("pattern") String pattern, @Param("limit") int limit);

	boolean existsByEmail(@Param("email") String email);

	boolean existsByUsername(@Param("username") String username);

}
