/*** Copyright 2016 Johannes Kessler 2016 Johannes Kessler
*
* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as i18n from 'i18next';
import { CodeInfo } from '../exec/CodeInfo';
import { Column } from '../exec/Column';
import { Difference } from '../exec/Difference';
import { Division } from '../exec/Division';
import { ExecutionError } from '../exec/ExecutionError';
import { AggregateFunction, GroupBy } from '../exec/GroupBy';
import { Intersect } from '../exec/Intersect';
import { AntiJoin } from '../exec/joins/AntiJoin';
import { CrossJoin } from '../exec/joins/CrossJoin';
import { FullOuterJoin } from '../exec/joins/FullOuterJoin';
import { InnerJoin } from '../exec/joins/InnerJoin';
import { JoinCondition, Join } from '../exec/joins/Join';
import { LeftOuterJoin } from '../exec/joins/LeftOuterJoin';
import { RightOuterJoin } from '../exec/joins/RightOuterJoin';
import { SemiJoin } from '../exec/joins/SemiJoin';
import { OrderBy } from '../exec/OrderBy';
import { Projection, ProjectionColumn } from '../exec/Projection';
import { RANode } from '../exec/RANode';
import { Relation } from '../exec/Relation';
import { RenameColumns } from '../exec/RenameColumns';
import { RenameRelation } from '../exec/RenameRelation';
import { Schema } from '../exec/Schema';
import { Selection } from '../exec/Selection';
import { Union } from '../exec/Union';
import * as ValueExpr from '../exec/ValueExpr';

function parseJoinCondition(condition: relalgAst.booleanExpr | string[] | null): JoinCondition {
	if (condition === null) {
		return {
			type: 'natural',
			restrictToColumns: null,
		};
	}
	else if (Array.isArray(condition)) {
		return {
			type: 'natural',
			restrictToColumns: (condition as string[]),
		};
	}
	else {
		return {
			type: 'theta',
			joinExpression: recValueExpr(condition as relalgAst.booleanExpr),
		};
	}
}

// translate a TRC-AST to RA
export function relalgFromTRCAstRoot(astRoot: trcAst.TRC_Expr | null, relations: { [key: string]: Relation }): RANode {
	// NOTE: this is map from tuple variable names to relation names
	let references = new Map<string, string>()

	function convertPredicate(predicate: trcAst.Predicate): relalgAst.valueExpr {
		const leftRelationName = references.get(predicate.left.variable) ?? null
		const leftArg: relalgAst.valueExpr = {
			type: 'valueExpr',
			datatype: 'null',
			func: 'columnValue',
			args: [
				predicate.left.attribute,
				leftRelationName
			],
			codeInfo: null as any
		}

		// TODO: add datatype info on the predicate 'AtrributeReference' node
		const func = (typeof predicate.right == 'object') ? 'columnValue' : 'constant'
		const arg = (typeof predicate.right == 'object') ? (predicate.right as trcAst.AttributeReference).attribute : predicate.right
		const datatype = (typeof predicate.right == 'object') ? 'null' : typeof predicate.right as 'number' | 'string'
		const rightRelationName = (typeof predicate.right == 'object') ? references.get(predicate.right.variable) : null
		const rightArg: relalgAst.valueExpr = {
			type: 'valueExpr',
			datatype,
			func,
			args: [arg, rightRelationName],
			codeInfo: null as any
		}

		const expr: relalgAst.valueExpr = {
			type: 'valueExpr',
			datatype: 'boolean',
			func: predicate.operator,
			args: [leftArg, rightArg],
			codeInfo: null as any
		}

		return expr
	}

	function setupReferences(root: any) {
		switch (root.type) {
			case 'TRC_Expr': { setupReferences(root.formula) } break
			case 'RelationPredicate': { references.set(root.variable, root.relation) } break
			case 'Negation': { setupReferences(root.formula) } break
			case 'QuantifiedExpression': { setupReferences(root.formula) } break
			case 'LogicalExpression': { setupReferences(root.left); setupReferences(root.right) } break
		}
	}

	function getFirstRelation(node: any): string | null {
		switch (node.type) {
			case 'TRC_Expr': return getFirstRelation(node.formula)
			case 'RelationPredicate':
				return node.relation
			case 'LogicalExpression': return getFirstRelation(node.left)
			default: return null
		}
	}

	function notOperator(op: string): string {
		const lookupTable: any = {
			'=': '!=',
			'!=': '=',
			'<': '>=',
			'>': '<=',
			'<=': '>',
			'>=': '<'
		}
		return lookupTable[op]
	}

	function usesVariableInPredicate(node: any, variable: string): boolean {
		switch (node.type) {
			case 'LogicalExpression': {
				const left = usesVariableInPredicate(node.left, variable)
				const right = usesVariableInPredicate(node.right, variable)
				return left || right
			}
			case 'Predicate': {
				if (node.left?.variable === variable || node.right?.variable === variable) {
					return true
				}
				return false
			}

			case 'Negation': {
				return usesVariableInPredicate(node.formula, variable)
			}

			case 'QuantifiedExpression': {
				return usesVariableInPredicate(node.formula, variable)
			}

			default: return false
		}
	}

	function rec(nRaw: trcAst.TRC_Expr | any, tupleVariable: string | null = null, negated: boolean = false): any {
		switch (nRaw.type) {
			case 'TRC_Expr': {
				if (nRaw.projections.length !== 0) {
					const relationName = getFirstRelation(nRaw)
					const projectedCols = nRaw.projections.map((c: string) => new Column(c, relationName))
					return new Projection(rec(nRaw.formula, nRaw.variable), projectedCols)
				}

				return rec(nRaw.formula, nRaw.variable)
			}

			case 'LogicalExpression': {
				// NOTE: p → q ≡ ¬p ∨ q
				if (nRaw.operator === 'implies') {
					const notLeft = {
						type: 'Negation',
						formula: nRaw.left
					}

					if (nRaw.left.type === 'RelationPredicate') {
						return rec(nRaw.right, tupleVariable, negated) as RANode
					}

					const right = rec(nRaw.right, tupleVariable) as RANode
					const left = rec(notLeft, tupleVariable, negated) as RANode
					return new Union(left, right)
				}

				const left = rec(nRaw.left, tupleVariable, negated) as RANode
				const right = rec(nRaw.right, tupleVariable, negated) as RANode

				if (nRaw.operator === 'or') {
					return new Union(left, right)
				}

				return new SemiJoin(left, right, true)
			}

			case 'QuantifiedExpression': {
				const resultFormula = rec(nRaw.formula, nRaw.variable, false)

				// TODO: Omg this is looking disgusting, gotta refactor that
				if (nRaw.quantifier === 'exists') {
					// NOTE: if we use the tuple variable inside the quantified
					// expression, that means we are actully performing a join
					const uses = usesVariableInPredicate(nRaw.formula, tupleVariable as string)
					if (uses) {
						const right = rec(nRaw.formula, nRaw.variable, negated)
						const predicate = nRaw.formula.right
						const cond = negated &&
							predicate && 
							predicate?.right.type === 'AttributeReference' &&
							predicate?.left.type === 'AttributeReference' &&
							predicate?.operator === '='

						if (cond) {
							const tupleVariableRelationName = references.get(tupleVariable as string)
							if (!tupleVariableRelationName) throw new Error(`Could not find relation with name: ${tupleVariableRelationName}`)
							const tupleVariableRelation = relations[tupleVariableRelationName].copy()

							return new AntiJoin(tupleVariableRelation, right, {
								type: 'natural',
								restrictToColumns: null,
							})

						}

						return right
					}

					const aggregate = [
						{
							aggFunction: "COUNT_ALL",
							col: null,
							name: "count"
						}
					]

					const condition: trcAst.Predicate = {
						type: 'Predicate',
						left: {
							type: 'AttributeReference',
							variable: null as any,
							attribute: 'count'
						},
						operator: negated ? '=' : '>',
						right: 0
					}
					// TODO: handle nested cases, not only the tuple variable
					// count = gamma count(*)->c(resultFormula)
					const count = new GroupBy(resultFormula, [], aggregate as any)
					const tupleVariableRelationName = references.get(tupleVariable as string)
					if (!tupleVariableRelationName) throw new Error(`Could not find relation with name: ${tupleVariableRelationName}`)
					const tupleVariableRelation = relations[tupleVariableRelationName].copy()
					// sigma c > 0 (tupleRel x count)
					return new Selection(new CrossJoin(tupleVariableRelation, count), recValueExpr(convertPredicate(condition)))
				} else {
					// NOTE: ∀xP(x) ≡ ¬∃x(¬P(x))
					const notFormula = usesVariableInPredicate(nRaw, tupleVariable as string) ? nRaw.formula : { type: 'Negation', formula: nRaw.formula }
					const notExists = {
						...nRaw,
						quantifier: 'exists',
						formula: notFormula
					}

					const uses = usesVariableInPredicate(nRaw.formula, tupleVariable as string)
					const shouldBeNegated = negated ? uses : !uses
					return rec(notExists, tupleVariable, shouldBeNegated)
				}
			}

			case 'RelationPredicate': {
				references.set(nRaw.variable, nRaw.relation)
				return relations[nRaw.relation].copy()
			}

			case 'Negation': {
				// NOTE: it means we're negating a predicate, so we can use set difference
				// NOTE: not(codition(R)) ≡ R - sigma condition(R) 
				switch (nRaw.formula.type) {
					case 'Negation': {
						return rec(nRaw.formula, tupleVariable, false)
					}

					case 'Predicate': {
						return rec(nRaw.formula, tupleVariable, true)
					}

					case 'QuantifiedExpression': {
						// NOTE: the negated quantified expression will always be 'exists',
						// because the universal quantifier is tranformed into an existencial one
						return rec(nRaw.formula, tupleVariable, true)
					}

					case 'LogicalExpression': {
						const notLeft = {
							type: 'Negation',
							formula: nRaw.formula.left
						}

						const notRight = {
							type: 'Negation',
							formula: nRaw.formula.right
						}

						switch (nRaw.formula.operator) {
							// ¬(A ∧ B) ≡ ¬A ∨ ¬B
							case 'and': {
								const or = {
									type: 'LogicalExpression',
									left: notLeft,
									operator: 'or',
									right: notRight
								}

								// NOTE: we can't negate a RelationPredicate
								if (nRaw.formula.left.type === 'RelationPredicate') {
									return rec(nRaw.formula.right, tupleVariable, true)
								}

								return rec(or, tupleVariable, true)
							}

							// ¬(A ∨ B) ≡ ¬A ∧ ¬B
							case 'or': {
								const and = {
									type: 'LogicalExpression',
									left: notLeft,
									operator: 'and',
									right: notRight
								}

								// NOTE: we can't negate a RelationPredicate
								if (nRaw.formula.left.type === 'RelationPredicate') {
									return rec(notRight, tupleVariable, true)
								}

								return rec(and, tupleVariable, true)
							}

							// ¬(A → B) ≡ A ∧ ¬B
							case 'implies': {
								const and = {
									type: 'LogicalExpression',
									left: nRaw.formula.left,
									operator: 'and',
									right: notRight
								}

								// NOTE: we can't negate a RelationPredicate
								if (nRaw.formula.left.type === 'RelationPredicate') {
									return rec(notRight, tupleVariable, true)
								}

								return rec(and, tupleVariable, false)
							}

							default:
								throw new Error('Unreachable')
						}
					}

					default:
						throw new Error('Negation is only allowed for predicates, logical expressions or quantified expressions!')
				}
			}

			case 'Predicate': {
				const leftRelationName = references.get(nRaw.left.variable)
				if (!leftRelationName) throw new Error(`Could not find relation with name: ${nRaw.left.variable}`)
				const leftRelation = relations[leftRelationName].copy()

				if (negated) {
					const notOp = notOperator(nRaw.operator)
					nRaw = { ...nRaw, operator: notOp }
				}

				// NOTE: that means we're dealing with a join
				if (nRaw.right.type === 'AttributeReference') {
					const rightRelationName = references.get(nRaw.right.variable)
					if (!rightRelationName) throw new Error(`Could not find relation with name: ${nRaw.right.variable}`)
					const rightRelation = relations[rightRelationName].copy()

					const join = new InnerJoin(leftRelation, rightRelation, {
						type: 'theta',
						joinExpression: recValueExpr(convertPredicate(nRaw)),
					})

					return join
				}

				const selection = new Selection(leftRelation, recValueExpr(convertPredicate(nRaw)))
				return selection
			}
		}
	}

	setupReferences(astRoot)
	return rec(astRoot)
}


// translate a SQL-AST to RA
export function relalgFromSQLAstRoot(astRoot: sqlAst.rootSql | any, relations: { [key: string]: Relation }): RANode {
	'use strict';

	function setCodeInfoFromNode(raNode: RANode, astNode: sqlAst.astNode) {
		if (!astNode.codeInfo) {
			throw new Error('should not happen');
		}

		raNode.setCodeInfoObject(astNode.codeInfo);
	}

	function rec(nRaw: sqlAst.astNode | any): RANode {
		let node: RANode | null = null;
		switch (nRaw.type) {
			case 'relation':
				{
					const n: any = nRaw;
					const start = Date.now();
					if (typeof (relations[n.name]) === 'undefined') {
						throw new ExecutionError(i18n.t('db.messages.translate.error-relation-not-found', { name: n.name }), n.codeInfo);
					}
					const rel = relations[n.name].copy();
					if (n.relAlias === null) {
						node = rel;
						node._execTime = Date.now() - start;
						break;
					}
					node = new RenameRelation(rel, n.relAlias);
					node._execTime = Date.now() - start;
				}
				break;

			case 'statement':
				{
					const start = Date.now();
					const n: any = nRaw;
					node = parseStatement(n);
					node._execTime = Date.now() - start;
					if (n.select.distinct === false) {
						node.addWarning(i18n.t('db.messages.translate.warning-distinct-missing'), n.codeInfo);
					}
				}
				break;

			case 'renameRelation':
				{
					const start = Date.now();
					const n: any = nRaw;
					node = new RenameRelation(rec(n.child), n.newRelAlias);
					node._execTime = Date.now() - start;
				}
				break;

			case 'relationFromSubstatement':
				{
					const start = Date.now();
					const n: any = nRaw;
					const rel = rec(n.statement);
					node = new RenameRelation(rel, n.relAlias);
					node._execTime = Date.now() - start;
				}
				break;

			case 'innerJoin':
			case 'leftOuterJoin':
			case 'rightOuterJoin':
			case 'fullOuterJoin':
				{
					const start = Date.now();
					const n: any = nRaw;
					const condition: JoinCondition = parseJoinCondition(n.cond);
					switch (n.type) {
						case 'innerJoin':
							node = new InnerJoin(rec(n.child), rec(n.child2), condition);
							node._execTime = Date.now() - start;
							break;
						case 'leftOuterJoin':
							node = new LeftOuterJoin(rec(n.child), rec(n.child2), condition);
							node._execTime = Date.now() - start;
							break;
						case 'rightOuterJoin':
							node = new RightOuterJoin(rec(n.child), rec(n.child2), condition);
							node._execTime = Date.now() - start;
							break;
						case 'fullOuterJoin':
							node = new FullOuterJoin(rec(n.child), rec(n.child2), condition);
							node._execTime = Date.now() - start;
							break;
					}
				}
				break;

			case 'crossJoin':
				{
					const start = Date.now();
					const n: any = nRaw;
					// check out size of resulting cross join!
					const rec1: any = rec(n.child);
					const rec2: any = rec(n.child2);
					const probableJoinCount = getRowLength(rec1) * getRowLength(rec2);

					// tried and tested with multiple devices / browsers
					// this seems to be where the browser starts to freeze up
					if (probableJoinCount > 1000000) {
						alert('The CrossJoin may cause the browser to crash. Alternatively try using an INNER JOIN');
					}
					node = new CrossJoin(rec(n.child), rec(n.child2));
					node._execTime = Date.now() - start;
				}
				break;

			case 'naturalJoin':
				{
					const start = Date.now();
					const n: any = nRaw;
					node = new InnerJoin(rec(n.child), rec(n.child2), {
						type: 'natural',
						restrictToColumns: null,
					});
					node._execTime = Date.now() - start;
				}
				break;

			case 'union':
			case 'intersect':
			case 'except':
				{
					const start = Date.now();
					const n: any = nRaw;
					switch (n.type) {
						case 'union':
							node = new Union(rec(n.child), rec(n.child2));
							node._execTime = Date.now() - start;
							break;
						case 'intersect':
							node = new Intersect(rec(n.child), rec(n.child2));
							node._execTime = Date.now() - start;
							break;
						case 'except':
							node = new Difference(rec(n.child), rec(n.child2));
							node._execTime = Date.now() - start;
							break;
					}

					if (n.all === true) {
						if (!node) {
							throw new Error(`should not happen`);
						}
						node.addWarning(i18n.t('db.messages.translate.warning-ignored-all-on-set-operators'), n.codeInfo);
					}
				}
				break;

			case 'orderBy':
				{
					const start = Date.now();
					const n: any = nRaw;
					const orderCols = [];
					const orderAsc = [];
					for (let i = 0; i < n.arg.value.length; i++) {
						const e = n.arg.value[i];

						orderAsc.push(e.asc);
						orderCols.push(new Column(e.col.name, e.col.relAlias));
					}
					node = new OrderBy(rec(n.child), orderCols, orderAsc);
					node._execTime = Date.now() - start;
				}
				break;

			case 'limit':
				{
					const start = Date.now();
					const n: any = nRaw;
					const limit = n.limit;
					const offset = n.offset;

					const conditionOffset = new ValueExpr.ValueExprGeneric('boolean', '>', [
						new ValueExpr.ValueExprGeneric('number', 'rownum', []),
						new ValueExpr.ValueExprGeneric('number', 'constant', [offset]),
					]);

					if (limit === -1) {
						// === LIMIT ALL => only offset
						node = new Selection(rec(n.child), conditionOffset);
						node._execTime = Date.now() - start;
					}
					else {
						// limit and offset
						const conditionLimit = new ValueExpr.ValueExprGeneric('boolean', '<=', [
							new ValueExpr.ValueExprGeneric('number', 'rownum', []),
							new ValueExpr.ValueExprGeneric('number', 'constant', [limit + offset]),
						]);
						node = new Selection(rec(n.child), new ValueExpr.ValueExprGeneric('boolean', 'and', [conditionOffset, conditionLimit]));
						node._execTime = Date.now() - start;
					}
					break;
				}

			default:
				throw new Error(`type ${nRaw.type} not implemented`);
		}

		if (!node) {
			throw new Error(`should not happen`);
		}



		if (nRaw.wrappedInParentheses === true) {
			node.setWrappedInParentheses(true);
		}

		setCodeInfoFromNode(node, nRaw);
		return node;
	}

	function getSelection(root: RANode, condition: sqlAst.booleanExpr, codeInfo: CodeInfo) {
		root.check();
		const node = new Selection(root, recValueExpr(condition));
		node.setCodeInfoObject(codeInfo);
		return node;
	}


	function isNamedColumn(arg: any): arg is sqlAst.namedColumn {
		return arg.type === 'column' && arg.alias;
	}

	function parseStatement(statement: sqlAst.statement) {
		const projectionArgs = statement.select.arg;

		// from-CLAUSE
		let root = rec(statement.from);
		setCodeInfoFromNode(root, statement.from);
		root.check();

		// selection
		if (statement.where !== null) {
			root = getSelection(root, statement.where.arg, statement.where.codeInfo);
			setCodeInfoFromNode(root, statement.where);
		}

		// group-by + aggregation
		if (statement.groupBy !== null || statement.numAggregationColumns > 0) {
			const aggregateFunctions: AggregateFunction[] = [];
			const groupByCols = statement.groupBy || [];

			// filter aggFunctions from SELECT list
			for (let i = 0; i < projectionArgs.length; i++) {
				const col = projectionArgs[i];
				if (col.type === 'aggFunction') {
					aggregateFunctions.push(col);
				}
			}

			if (aggregateFunctions.length > 0) {
				root = new GroupBy(root, groupByCols, aggregateFunctions);
			}
			else {
				// use projection if no aggregation is used
				const projections: Column[] = [];
				for (let i = 0; i < groupByCols.length; i++) {
					const col = groupByCols[i];
					projections.push(new Column(col.name, col.relAlias));
				}
				root = new Projection(root, projections);
			}
		}


		// having
		if (statement.having !== null) {
			root = getSelection(root, statement.having.arg, statement.having.codeInfo);
			setCodeInfoFromNode(root, statement.having);
		}

		// projection
		let colsRenamed = false;
		if (projectionArgs.length === 1 && projectionArgs[0].type === 'column' && (projectionArgs[0] as sqlAst.columnName).name === '*' && (projectionArgs[0] as sqlAst.columnName).relAlias === null) {
			// select * => no projection needed
		}
		else {
			const projections: ProjectionColumn[] = [];
			for (let i = 0; i < projectionArgs.length; i++) {
				const col = projectionArgs[i];

				if (col.type === 'aggFunction') {
					projections.push(new Column(col.name, null)); // has been renamed by gamma
				}
				else if (col.type === 'namedColumnExpr') {
					projections.push({
						name: col.name,
						relAlias: col.relAlias,
						child: recValueExpr(col.child),
					});
				}
				else if (col.type === 'column') {
					// normal columns
					projections.push(new Column(col.name, col.relAlias));

					if (isNamedColumn(col)) {
						colsRenamed = true;
					}
				}
				else {
					throw new Error('this should not happen');
				}
			}
			root = new Projection(root, projections);
			setCodeInfoFromNode(root, statement.select);
		}

		// rename columns
		if (colsRenamed === true) {
			const tmp = new RenameColumns(root);

			for (let i = 0; i < projectionArgs.length; i++) {
				const arg = projectionArgs[i];
				if (isNamedColumn(arg)) {
					tmp.addRenaming(arg.alias, arg.name, arg.relAlias);
				}
			}
			root = tmp;
		}

		return root;
	}

	return rec(astRoot.child);
}

function recValueExpr(n: relalgAst.valueExpr | sqlAst.valueExpr): ValueExpr.ValueExpr {
	let node: ValueExpr.ValueExpr;
	if (n.datatype === 'null' && n.func === 'columnValue') {
		node = new ValueExpr.ValueExprColumnValue(n.args[0], n.args[1]);
	}
	else {
		switch (n.datatype) {
			case 'string':
			case 'number':
			case 'boolean':
			case 'date':
			case 'null': // all with unknown type
				const tmp = [];
				for (let i = 0; i < n.args.length; i++) {
					if (n.func === 'constant') {
						tmp.push(n.args[i]);
					}
					else {
						tmp.push(recValueExpr(n.args[i]));
					}
				}

				node = new ValueExpr.ValueExprGeneric(n.datatype, n.func, tmp);
				break;
			default:
				throw new Error('not implemented yet');
		}
	}

	node.setCodeInfoObject(n.codeInfo);
	if (n.wrappedInParentheses === true) {
		node.setWrappedInParentheses(true);
	}
	return node;
}

function getRowLength(node: any, length: number = 0): number {
	if (!node) { return 0; }
	if (node._table) {
		return node._table._rows.length;
	}
	if (node._child) {
		return getRowLength(node._child) * getRowLength(node._child2);
	}
	return 0;
}



function setAdditionalData<T extends RANode>(astNode: relalgAst.relalgOperation, node: T): void {
	node.setCodeInfoObject(astNode.codeInfo);

	if (typeof (astNode.metaData) !== 'undefined') {
		for (const key in astNode.metaData) {
			if (!astNode.metaData.hasOwnProperty(key)) {
				continue;
			}

			node.setMetaData(key as any, astNode.metaData[key]);
		}
	}

	if (astNode.wrappedInParentheses === true) {
		node.setWrappedInParentheses(true);
	}
}



// translates a RA-AST to RA
export function relalgFromRelalgAstRoot(astRoot: relalgAst.rootRelalg, relations: { [key: string]: Relation }) {
	// root is the real root node! of a statement
	return relalgFromRelalgAstNode(astRoot.child, relations);
}

/**
 * translates a RA-AST node to RA
 * @param   {Object} astNode   a node of a RA-AST
 * @param   {Object} relations hash of the relations that could be used in the statement
 * @returns {Object} an actual RA-expression
 */
export function relalgFromRelalgAstNode(astNode: relalgAst.relalgOperation, relations: { [key: string]: Relation }): RANode {
	function recRANode(n: relalgAst.relalgOperation): RANode {
		switch (n.type) {
			case 'relation':
				{
					if (typeof (relations[n.name]) === 'undefined') {
						throw new ExecutionError(i18n.t('db.messages.translate.error-relation-not-found', { name: n.name }), n.codeInfo);
					}
					const node = relations[n.name].copy();
					setAdditionalData(n, node);
					return node;
				}

			case 'table':
				{
					const schema = new Schema();
					for (let i = 0; i < n.columns.length; i++) {
						const col = n.columns[i];
						schema.addColumn(col.name, col.relAlias, col.type);
					}
					const start = Date.now();
					const rel = new Relation(n.name);
					rel.setSchema(schema, true);
					rel.addRows(n.rows);
					rel.setMetaData('isInlineRelation', true);
					rel.setMetaData('inlineRelationDefinition', n.codeInfo.text);
					// TODO: inlineRelationDefinition should be replaced; there should be a generic way to get the definition of a node
					const node = rel;
					node._execTime = Date.now() - start;
					setAdditionalData(n, node);
					return node;
				}

			case 'selection':
				{
					// TODO: Missing here...
					const start = Date.now();
					const child = recRANode(n.child);
					const condition = recValueExpr(n.arg);
					const node = new Selection(child, condition);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;
					return node;
				}

			case 'projection':
				{
					const child = recRANode(n.child);
					const start = Date.now();
					const projections: (Column | {
						name: string | number,
						relAlias: string,
						child: ValueExpr.ValueExpr,
					})[] = [];
					for (let i = 0; i < n.arg.length; i++) {
						const el = n.arg[i];

						if (el.type === 'columnName') {
							const e = el as relalgAst.columnName;
							projections.push(new Column(e.name, e.relAlias));
						}
						else if (el.type === 'namedColumnExpr') {
							const e = el as relalgAst.namedColumnExpr;
							// namedColumnExpr
							projections.push({
								name: e.name,
								relAlias: e.relAlias,
								child: recValueExpr(e.child),
							});
						}
						else {
							throw new Error('should not happen');
						}
					}

					const node = new Projection(child, projections);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;
					return node;
				}

			case 'orderBy':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const orderCols: Column[] = [];
					const orderAsc: boolean[] = [];

					for (let i = 0; i < n.arg.length; i++) {
						const e = n.arg[i];

						orderAsc.push(e.asc);
						orderCols.push(new Column(e.col.name, e.col.relAlias));
					}

					const node = new OrderBy(child, orderCols, orderAsc);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'groupBy':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const aggregateFunctions = n.aggregate;
					const groupByCols = n.group;

					const node = new GroupBy(child, groupByCols, aggregateFunctions);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'union':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new Union(child, child2);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'intersect':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new Intersect(child, child2);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'division':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new Division(child, child2);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'difference':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new Difference(child, child2);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'renameColumns':
				{
					const start = Date.now();
					const ren = new RenameColumns(recRANode(n.child));

					for (let i = 0; i < n.arg.length; i++) {
						const e = n.arg[i];

						ren.addRenaming(e.dst, e.src.name, e.src.relAlias);
					}

					const node = ren;
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'renameRelation':
				{
					const start = Date.now();
					const child = recRANode(n.child);
					const node = new RenameRelation(child, n.newRelAlias);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'thetaJoin':
				{
					const start = Date.now();
					const condition: JoinCondition = {
						type: 'theta',
						joinExpression: recValueExpr(n.arg),
					};
					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new InnerJoin(child, child2, condition);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'crossJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new CrossJoin(child, child2);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'naturalJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new InnerJoin(child, child2, {
						type: 'natural',
						restrictToColumns: null,
					});
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'leftSemiJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new SemiJoin(child, child2, true);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'rightSemiJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const node = new SemiJoin(child, child2, false);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'antiJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const condition = parseJoinCondition(n.arg);
					const node = new AntiJoin(child, child2, condition);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'leftOuterJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const condition = parseJoinCondition(n.arg);
					const node = new LeftOuterJoin(child, child2, condition);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'rightOuterJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const condition = parseJoinCondition(n.arg);
					const node = new RightOuterJoin(child, child2, condition);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}

			case 'fullOuterJoin':
				{
					const start = Date.now();

					const child = recRANode(n.child);
					const child2 = recRANode(n.child2);
					const condition = parseJoinCondition(n.arg);
					const node = new FullOuterJoin(child, child2, condition);
					setAdditionalData(n, node);
					node._execTime = Date.now() - start;

					return node;
				}
		}
	}

	return recRANode(astNode);
}