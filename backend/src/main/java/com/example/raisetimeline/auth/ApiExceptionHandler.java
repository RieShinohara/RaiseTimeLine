package com.example.raisetimeline.auth;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// エラーを、{"message": "..."} の形にそろえて返す
@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(ApiException.class)
	ResponseEntity<Map<String, String>> handleApi(ApiException e) {
		return ResponseEntity.status(e.getStatus()).body(Map.of("message", e.getMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
		// 誤りが複数あるときは、入力の項目の順（DTO に書いた順）で、先頭の 1 件を返す。
		// 以前は、メッセージを日本語の文字順に並べていて、どれが出るかに意味がなかった（B6）
		List<String> order = fieldOrder(e.getBindingResult().getTarget());
		String message = e.getBindingResult().getFieldErrors().stream()
				.sorted(Comparator.comparingInt((FieldError error) -> positionOf(order, error.getField()))
						.thenComparing(error -> String.valueOf(error.getDefaultMessage())))
				.map(FieldError::getDefaultMessage)
				.findFirst()
				.orElse("入力が正しくありません");
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
	}

	// 入力の DTO（record）の項目名を、書いた順に返す。record でなければ、空
	private static List<String> fieldOrder(Object target) {
		if (target == null || !target.getClass().isRecord()) {
			return List.of();
		}
		return Arrays.stream(target.getClass().getRecordComponents()).map(RecordComponent::getName).toList();
	}

	private static int positionOf(List<String> order, String field) {
		int index = order.indexOf(field);
		return index < 0 ? Integer.MAX_VALUE : index;
	}

}
