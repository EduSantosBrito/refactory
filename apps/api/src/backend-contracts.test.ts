import { expect, test } from "bun:test";
import ts from "typescript";

const packageRoot = new URL("..", import.meta.url);
const srcRoot = new URL("./", import.meta.url);
const tsconfigPath = new URL("../tsconfig.json", import.meta.url).pathname;

const readConfig = () => {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error !== undefined) {
    throw new Error(
      ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
    );
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    packageRoot.pathname,
  );

  if (parsed.errors.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => packageRoot.pathname,
        getNewLine: () => "\n",
      }),
    );
  }

  return parsed;
};

const relativeToSrc = (fileName: string) =>
  fileName.replace(srcRoot.pathname, "");

test("backend exported functions return Effect, Layer, or Stream", () => {
  const parsed = readConfig();
  const program = ts.createProgram({
    options: parsed.options,
    rootNames: parsed.fileNames,
  });
  const checker = program.getTypeChecker();
  const violations: Array<string> = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (
      !sourceFile.fileName.startsWith(srcRoot.pathname) ||
      sourceFile.fileName.endsWith(".test.ts")
    ) {
      continue;
    }

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

    if (moduleSymbol === undefined) {
      continue;
    }

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const declaration =
        exported.valueDeclaration ?? exported.declarations?.[0];

      if (declaration === undefined) {
        continue;
      }

      const type = checker.getTypeOfSymbolAtLocation(exported, declaration);
      const signatures = type.getCallSignatures();

      if (signatures.length === 0) {
        continue;
      }

      for (const signature of signatures) {
        const returnType = checker.typeToString(signature.getReturnType());
        const isAllowed =
          returnType.includes("Effect<") ||
          returnType.includes("Effect.Effect<") ||
          returnType.includes("Layer<") ||
          returnType.includes("Layer.Layer<") ||
          returnType.includes("Stream<") ||
          returnType.includes("Stream.Stream<");

        if (!isAllowed) {
          violations.push(
            `${relativeToSrc(sourceFile.fileName)}:${exported.getName()} -> ${returnType}`,
          );
        }
      }
    }
  }

  expect(violations).toEqual([]);
});

test("backend source avoids sync decode and raw throw contracts", () => {
  const parsed = readConfig();
  const violations: Array<string> = [];

  for (const fileName of parsed.fileNames) {
    if (
      !fileName.startsWith(srcRoot.pathname) ||
      fileName.endsWith(".test.ts")
    ) {
      continue;
    }

    const source = ts.sys.readFile(fileName);

    if (source === undefined) {
      continue;
    }

    if (source.includes("Schema.decodeUnknownSync(")) {
      violations.push(`${relativeToSrc(fileName)}: Schema.decodeUnknownSync`);
    }

    if (source.includes("throw new Error(")) {
      violations.push(`${relativeToSrc(fileName)}: throw new Error`);
    }
  }

  expect(violations).toEqual([]);
});
