#!/usr/bin/env node
/**
 * check-hook-ordering.cjs
 *
 * AST-based scan of React page components for temporal dead zone (TDZ)
 * ordering bugs: any useMemo/useCallback dep-array, callback body, or
 * const/let initializer that references a variable declared LATER in the
 * same component scope — causing a ReferenceError on every render.
 *
 * Uses the TypeScript compiler API for accurate TSX AST parsing.
 *
 * Usage:
 *   node scripts/check-hook-ordering.cjs          # scan all pages
 *   node scripts/check-hook-ordering.cjs --test   # run built-in self-tests
 *
 * Exit 0 = clean / tests pass.  Exit 1 = issues found / tests fail.
 */

"use strict";

const ts = require("typescript");
const fs = require("fs");
const path = require("path");

// ── known globals and builtins to skip ───────────────────────────────────────

const GLOBAL_SKIP = new Set([
  // JS built-ins
  "undefined", "null", "true", "false", "NaN", "Infinity",
  "console", "window", "document", "navigator", "location",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "Promise", "Array", "Object", "String", "Number", "Boolean",
  "Map", "Set", "WeakMap", "WeakSet", "Error", "JSON", "Math",
  "Date", "RegExp", "Symbol", "parseInt", "parseFloat", "isNaN",
  "fetch", "URL", "URLSearchParams",
  // React
  "React", "useState", "useEffect", "useMemo", "useCallback",
  "useRef", "useContext", "useReducer", "useLayoutEffect",
  "useImperativeHandle", "useDebugValue", "useId",
  // common lib re-exports the project uses
  "queryClient", "toast",
]);

// ── AST helpers ──────────────────────────────────────────────────────────────

function isFunctionScope(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

/**
 * Collect all identifier references inside `node` that are plain variable
 * reads (not property names, not declaration names, not type positions).
 * Stops descending into nested function boundaries to avoid capturing
 * closure references from inner functions' own scopes incorrectly.
 */
function collectIdentifierRefs(node, stopAtFunctionBoundary = false) {
  const refs = new Set();

  function visit(n) {
    // Don't cross into nested function bodies — they create their own scope.
    if (stopAtFunctionBoundary && n !== node && isFunctionScope(n)) {
      // But still collect refs from their parameter default values and dep arrays
      // (those execute in the outer scope at call time).
      return;
    }

    if (ts.isIdentifier(n)) {
      const name = n.text;
      if (GLOBAL_SKIP.has(name)) return;

      const parent = n.parent;
      if (!parent) { refs.add(name); return; }

      // Skip: right-hand side of property access (foo.BAR)
      if (ts.isPropertyAccessExpression(parent) && parent.name === n) return;

      // Skip: property key in object literal ({ KEY: val } or shorthand { key })
      if (ts.isPropertyAssignment(parent) && parent.name === n) return;

      // Skip: property name in type literal ({ name: Type }), interface method
      // signatures, index signatures, etc. — these are type positions, not
      // runtime variable references.
      if (ts.isPropertySignature(parent) && parent.name === n) return;
      if (ts.isMethodSignature(parent) && parent.name === n) return;
      if (ts.isIndexSignatureDeclaration(parent)) return;

      // Skip: binding name in a declaration (const NAME = ...)
      if (ts.isBindingElement(parent) && parent.name === n) return;
      if (ts.isVariableDeclaration(parent) && parent.name === n) return;
      if (ts.isParameter(parent) && parent.name === n) return;

      // Skip: import/export identifiers
      if (
        ts.isImportSpecifier(parent) ||
        ts.isExportSpecifier(parent) ||
        ts.isImportClause(parent)
      )
        return;

      // Skip: type positions (type annotations, type parameters, type references)
      if (
        ts.isTypeReferenceNode(parent) ||
        ts.isTypeParameterDeclaration(parent) ||
        ts.isTypeLiteralNode(parent)
      )
        return;

      refs.add(name);
    }

    ts.forEachChild(n, visit);
  }

  ts.forEachChild(node, visit);
  return refs;
}

/**
 * Collect locally-declared names inside a function (parameters + inner decls),
 * used to exclude them when checking references inside callback bodies.
 */
function collectLocalNames(funcNode) {
  const names = new Set();

  // Function parameters
  if (funcNode.parameters) {
    for (const param of funcNode.parameters) {
      collectBindingNamesIntoSet(param.name, names);
    }
  }

  // Inner declarations (walk full body)
  if (funcNode.body) {
    function visitInner(n) {
      if (n !== funcNode && isFunctionScope(n)) return; // don't cross nested funcs
      if (ts.isVariableDeclaration(n)) {
        collectBindingNamesIntoSet(n.name, names);
      }
      ts.forEachChild(n, visitInner);
    }
    visitInner(funcNode.body);
  }

  return names;
}

function collectBindingNamesIntoSet(nameNode, set) {
  if (ts.isIdentifier(nameNode)) {
    set.add(nameNode.text);
  } else if (ts.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.elements) collectBindingNamesIntoSet(el.name, set);
  } else if (ts.isArrayBindingPattern(nameNode)) {
    for (const el of nameNode.elements) {
      if (!ts.isOmittedExpression(el)) collectBindingNamesIntoSet(el.name, set);
    }
  }
}

/**
 * Collect every const/let variable declared directly at the top level of
 * bodyNode (not nested into another function). Returns Map<name, 1-indexed line>.
 */
function collectDirectDecls(bodyNode, sourceFile) {
  const decls = new Map();

  function visitStmts(stmts) {
    for (const stmt of stmts) {
      if (isFunctionScope(stmt)) continue;

      if (ts.isVariableStatement(stmt)) {
        const flags = stmt.declarationList.flags;
        const isConstOrLet =
          !!(flags & ts.NodeFlags.Const) || !!(flags & ts.NodeFlags.Let);
        if (isConstOrLet) {
          for (const decl of stmt.declarationList.declarations) {
            collectBindingNamesWithLine(decl.name, sourceFile, decls);
          }
        }
      }

      if (ts.isBlock(stmt)) visitStmts(stmt.statements);
      else if (ts.isIfStatement(stmt)) {
        if (ts.isBlock(stmt.thenStatement))
          visitStmts(stmt.thenStatement.statements);
        if (stmt.elseStatement && ts.isBlock(stmt.elseStatement))
          visitStmts(stmt.elseStatement.statements);
      }
    }
  }

  if (bodyNode && ts.isBlock(bodyNode)) visitStmts(bodyNode.statements);
  return decls;
}

function collectBindingNamesWithLine(nameNode, sourceFile, map) {
  if (ts.isIdentifier(nameNode)) {
    if (!map.has(nameNode.text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        nameNode.getStart(sourceFile)
      );
      map.set(nameNode.text, line + 1); // 1-indexed
    }
  } else if (ts.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.elements)
      collectBindingNamesWithLine(el.name, sourceFile, map);
  } else if (ts.isArrayBindingPattern(nameNode)) {
    for (const el of nameNode.elements) {
      if (!ts.isOmittedExpression(el))
        collectBindingNamesWithLine(el.name, sourceFile, map);
    }
  }
}

// ── dep-array identifier extraction ─────────────────────────────────────────

function extractDepArrayIdentifiers(callExpr) {
  if (callExpr.arguments.length < 2) return [];
  const depsArg = callExpr.arguments[1];
  if (!ts.isArrayLiteralExpression(depsArg)) return [];

  const names = [];
  for (const el of depsArg.elements) {
    if (ts.isIdentifier(el)) {
      names.push(el.text);
    } else if (
      ts.isPropertyAccessExpression(el) &&
      ts.isIdentifier(el.expression)
    ) {
      names.push(el.expression.text);
    }
  }
  return names;
}

// ── per-component analysis ───────────────────────────────────────────────────

function analyzeFunction(funcNode, funcName, sourceFile) {
  const body = funcNode.body;
  if (!body || !ts.isBlock(body)) return [];

  const issues = [];

  // All const/let declarations directly in this component, with their lines.
  const decls = collectDirectDecls(body, sourceFile);

  // Walk direct statements looking for variable declarations.
  function visitStmts(stmts) {
    for (const stmt of stmts) {
      if (isFunctionScope(stmt)) continue;

      if (ts.isVariableStatement(stmt)) {
        const flags = stmt.declarationList.flags;
        const isConstOrLet =
          !!(flags & ts.NodeFlags.Const) || !!(flags & ts.NodeFlags.Let);
        if (!isConstOrLet) continue;

        for (const decl of stmt.declarationList.declarations) {
          const { line: stmtLineZero } = sourceFile.getLineAndCharacterOfPosition(
            stmt.getStart(sourceFile)
          );
          const stmtLine = stmtLineZero + 1; // 1-indexed

          const init = decl.initializer;
          if (!init) continue;

          const isHook =
            ts.isCallExpression(init) &&
            ts.isIdentifier(init.expression) &&
            (init.expression.text === "useMemo" ||
              init.expression.text === "useCallback");

          if (isHook) {
            const hookType = init.expression.text;

            // 1) Check dependency array identifiers.
            const depIds = extractDepArrayIdentifiers(init);
            for (const ident of depIds) {
              if (GLOBAL_SKIP.has(ident)) continue;
              if (decls.has(ident) && decls.get(ident) > stmtLine) {
                issues.push({
                  file: sourceFile.fileName,
                  funcName,
                  hookType,
                  hookLine: stmtLine,
                  dep: ident,
                  depLine: decls.get(ident),
                  location: "dep-array",
                });
              }
            }

            // 2) Check callback body identifiers (first argument).
            if (init.arguments.length > 0) {
              const callback = init.arguments[0];
              if (isFunctionScope(callback)) {
                const localNames = collectLocalNames(callback);
                const bodyRefs = collectIdentifierRefs(callback, true);
                for (const ident of bodyRefs) {
                  if (GLOBAL_SKIP.has(ident)) continue;
                  if (localNames.has(ident)) continue; // declared inside callback
                  if (decls.has(ident) && decls.get(ident) > stmtLine) {
                    issues.push({
                      file: sourceFile.fileName,
                      funcName,
                      hookType,
                      hookLine: stmtLine,
                      dep: ident,
                      depLine: decls.get(ident),
                      location: "callback-body",
                    });
                  }
                }
              }
            }
          } else {
            // 3) General const/let initializer — check identifier refs that
            // execute at render time.
            //
            // If the entire initializer IS a function (arrow fn, fn expression),
            // the body only runs when the function is called — not at render time.
            // Skip it entirely to avoid false positives on event handlers.
            if (isFunctionScope(init)) continue;
            // For all other initializers, stop at nested function boundaries:
            // inner callbacks don't execute at render time.
            const refs = collectIdentifierRefs(init, true);
            for (const ident of refs) {
              if (GLOBAL_SKIP.has(ident)) continue;
              if (decls.has(ident) && decls.get(ident) > stmtLine) {
                issues.push({
                  file: sourceFile.fileName,
                  funcName,
                  hookType: "const",
                  hookLine: stmtLine,
                  dep: ident,
                  depLine: decls.get(ident),
                  location: "initializer",
                });
              }
            }
          }
        }
      }

      if (ts.isBlock(stmt)) visitStmts(stmt.statements);
      else if (ts.isIfStatement(stmt)) {
        if (ts.isBlock(stmt.thenStatement))
          visitStmts(stmt.thenStatement.statements);
        if (stmt.elseStatement && ts.isBlock(stmt.elseStatement))
          visitStmts(stmt.elseStatement.statements);
      }
    }
  }

  visitStmts(body.statements);

  // Deduplicate: same variable on same hook line counts as one issue,
  // even if it appears in both the dep-array and the callback body.
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.hookLine}:${issue.dep}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── file analysis ────────────────────────────────────────────────────────────

function checkSource(code, filename) {
  const sourceFile = ts.createSourceFile(
    filename || "test.tsx",
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );

  const issues = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      issues.push(...analyzeFunction(stmt, stmt.name.text, sourceFile));
    } else if (
      ts.isExportAssignment(stmt) &&
      stmt.expression &&
      isFunctionScope(stmt.expression)
    ) {
      issues.push(...analyzeFunction(stmt.expression, "default", sourceFile));
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (decl.initializer && isFunctionScope(decl.initializer)) {
          const name = ts.isIdentifier(decl.name) ? decl.name.text : "anon";
          issues.push(...analyzeFunction(decl.initializer, name, sourceFile));
        }
      }
    }
  }

  return issues;
}

function checkFile(filepath) {
  const code = fs.readFileSync(filepath, "utf8");
  return checkSource(code, filepath);
}

// ── built-in self-tests ──────────────────────────────────────────────────────

function runSelfTests() {
  const tests = [
    {
      name: "dep-array TDZ: catches dep declared after hook",
      code: `
function MyPage() {
  const x = useMemo(() => foo * 2, [foo]);
  const foo = 42;
}`,
      expectIssues: 1,
    },
    {
      name: "callback-body TDZ: catches body reference declared after hook",
      code: `
function MyPage() {
  const x = useMemo(() => bar + 1, []);
  const bar = 10;
}`,
      expectIssues: 1,
    },
    {
      name: "initializer TDZ: catches const initializer referencing later decl",
      code: `
function MyPage() {
  const label = baz.name;
  const baz = { name: "hi" };
}`,
      expectIssues: 1,
    },
    {
      name: "no TDZ: dep declared before hook — clean",
      code: `
function MyPage() {
  const foo = 42;
  const x = useMemo(() => foo * 2, [foo]);
}`,
      expectIssues: 0,
    },
    {
      name: "no TDZ: property access on dep-array item does not false-positive",
      code: `
function MyPage() {
  const x = useMemo(() => items.map(i => i.id), [items]);
  const items = [];
}`,
      // 'items' IS referenced before its decl here — this IS a TDZ bug.
      // The scanner should catch it.
      expectIssues: 1,
    },
    {
      name: "no false positive: inner function captures outer var legitimately",
      code: `
function MyPage() {
  const count = 5;
  const handler = useCallback(() => {
    return count * 2;
  }, [count]);
}`,
      expectIssues: 0,
    },
    {
      name: "callback-body TDZ: var referenced in callback is declared after",
      code: `
function MyPage() {
  const handler = useCallback(() => {
    doThing(lateVar);
  }, []);
  const lateVar = "hello";
}`,
      expectIssues: 1,
    },
    {
      name: "no false positive: prop access obj.method does not flag method",
      code: `
function MyPage() {
  const early = { method: () => 1 };
  const x = useMemo(() => early.method(), [early]);
}`,
      expectIssues: 0,
    },
    {
      name: "no false positive: type literal property name in useQuery generic",
      code: `
function MyPage() {
  const { data: companiesData } = useQuery<{ companies: Company[]; total: number }>({
    queryKey: ["/api/companies"],
  });
  const companies = companiesData?.companies ?? [];
}`,
      expectIssues: 0,
    },
    {
      name: "no false positive: useMutation onSuccess callback using later-declared fn",
      code: `
function MyPage() {
  const createMutation = useMutation({
    onSuccess: () => {
      closeForm();
    },
  });
  const closeForm = () => {
    setShow(false);
  };
}`,
      expectIssues: 0,
    },
    {
      name: "no false positive: event handler arrow fn referencing later-declared fn",
      code: `
function MyPage() {
  const handleSubmit = (e) => {
    if (!validatePostcode(value)) return;
  };
  const validatePostcode = (v) => v.length > 3;
}`,
      expectIssues: 0,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, code, expectIssues } of tests) {
    const issues = checkSource(code, "test-fixture.tsx");
    const found = issues.length;
    if (found === expectIssues) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}`);
      console.error(`    Expected ${expectIssues} issue(s), got ${found}`);
      if (found > 0) {
        for (const i of issues)
          console.error(
            `      Line ${i.hookLine}: ${i.hookType} depends on '${i.dep}' at line ${i.depLine} [${i.location}]`
          );
      }
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  return failed === 0;
}

// ── main ─────────────────────────────────────────────────────────────────────

if (process.argv.includes("--test")) {
  console.log("Running self-tests…\n");
  const ok = runSelfTests();
  process.exit(ok ? 0 : 1);
}

const pagesDir = path.join(__dirname, "..", "client", "src", "pages");
const files = fs
  .readdirSync(pagesDir)
  .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
  .map((f) => path.join(pagesDir, f))
  .sort();

let totalIssues = 0;

for (const filepath of files) {
  let issues;
  try {
    issues = checkFile(filepath);
  } catch (err) {
    console.error(
      `Error parsing ${path.relative(process.cwd(), filepath)}: ${err.message}`
    );
    continue;
  }

  if (issues.length > 0) {
    console.error(`\n${path.relative(process.cwd(), filepath)}`);
    for (const issue of issues) {
      console.error(
        `  Line ${issue.hookLine}: ${issue.hookType} in '${issue.funcName}' ` +
          `depends on '${issue.dep}' declared at line ${issue.depLine} [${issue.location}]`
      );
      totalIssues++;
    }
  }
}

if (totalIssues === 0) {
  console.log(
    `✓ No hook/initializer ordering (TDZ) issues found across ${files.length} page files.`
  );
  process.exit(0);
} else {
  console.error(
    `\n✗ ${totalIssues} ordering issue(s) found. ` +
      `Move each flagged declaration above the statement that depends on it.`
  );
  process.exit(1);
}
