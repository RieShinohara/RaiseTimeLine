package com.example.raisetimeline;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

// 層の向きの検査（品質チェック B5）。窓口（Controller）→ 業務の決まり（Service）→ DB（Mapper）の一方向だけ。
// 逆向きや、飛ばした呼び出し（Controller が直接 Mapper を呼ぶ）があれば、失敗する
class ArchitectureTests {

	private static JavaClasses imported;

	@BeforeAll
	static void importClasses() {
		// 本番のコードだけを読む（テストのクラスは、対象外）
		imported = new ClassFileImporter()
				.withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
				.importPackages("com.example.raisetimeline");
	}

	@Test
	void 読み込めたクラスがある() {
		// 空のフォルダを調べて「成功」にならないための確認（CLAUDE.md 7）
		org.assertj.core.api.Assertions.assertThat(imported.size()).isGreaterThan(10);
		org.assertj.core.api.Assertions.assertThat(imported.stream()
				.filter(c -> c.getSimpleName().endsWith("Controller")).count()).isGreaterThanOrEqualTo(2);
	}

	@Test
	void ControllerはMapperを直接呼ばない() {
		ArchRule rule = noClasses().that().haveSimpleNameEndingWith("Controller")
				.should().dependOnClassesThat().haveSimpleNameEndingWith("Mapper");
		rule.check(imported);
	}

	@Test
	void MapperはServiceやControllerを呼ばない() {
		ArchRule rule = noClasses().that().haveSimpleNameEndingWith("Mapper")
				.should().dependOnClassesThat().haveSimpleNameEndingWith("Service")
				.orShould().dependOnClassesThat().haveSimpleNameEndingWith("Controller");
		rule.check(imported);
	}

	@Test
	void ServiceはControllerを呼ばない() {
		ArchRule rule = noClasses().that().haveSimpleNameEndingWith("Service")
				.should().dependOnClassesThat().haveSimpleNameEndingWith("Controller");
		rule.check(imported);
	}

	@Test
	void Mapperは必ずインターフェース() {
		ArchRule rule = classes().that().haveSimpleNameEndingWith("Mapper").should().beInterfaces();
		rule.check(imported);
	}

}
