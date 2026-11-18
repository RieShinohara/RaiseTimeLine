package com.example.raisetimeline.post;

import java.util.concurrent.atomic.AtomicInteger;

import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Signature;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;

// テスト専用：MyBatis が SELECT（読む SQL）を実行するたびに、数える「見張り」。
// N+1 問題を、「SQL が何回走ったか」の数字で確かめるために使う（本番のコードには入れない）
@Intercepts({
		@Signature(type = Executor.class, method = "query", args = { MappedStatement.class, Object.class,
				RowBounds.class, ResultHandler.class })
})
public class SqlCountInterceptor implements Interceptor {

	private final AtomicInteger selects = new AtomicInteger();

	@Override
	public Object intercept(Invocation invocation) throws Throwable {
		selects.incrementAndGet();
		return invocation.proceed();
	}

	public void reset() {
		selects.set(0);
	}

	public int selects() {
		return selects.get();
	}

}
