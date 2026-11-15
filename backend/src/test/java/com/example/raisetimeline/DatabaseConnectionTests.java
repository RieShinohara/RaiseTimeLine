package com.example.raisetimeline;

import static org.assertj.core.api.Assertions.assertThat;

import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

// 土台の確認：アプリが起動し、MyBatis 経由で、使い捨ての PostgreSQL に SQL を流せる
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class DatabaseConnectionTests {

	@Autowired
	private SqlSessionFactory sqlSessionFactory;

	@Test
	void mybatisCanRunSql() throws SQLException {
		try (SqlSession session = sqlSessionFactory.openSession();
				Statement statement = session.getConnection().createStatement();
				ResultSet result = statement.executeQuery("SELECT 1")) {
			assertThat(result.next()).isTrue();
			assertThat(result.getInt(1)).isEqualTo(1);
		}
	}

}
