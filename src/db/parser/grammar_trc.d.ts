declare namespace trcAst {
	type astNode = rootTrc

	interface rootTrc {
		type: 'trcRoot',
		child: Expression,
		child2: undefined,
	}

	interface Expression {
		type: 'expression',
		projection: Projection,
		predicate: Predicate
	}

	interface Projection {
		type: 'projection',
		relation: string,
		columns: string[]
	}

	interface Predicate {
		type: 'predicate',
		quantifier: string,
		relation: string,
		relationAlias: string,
		condition: booleanExpr
	}

	// interface Condition {
	// 	type: 'comparison',
	// 	attribute: string,
	// 	operator: string,
	// 	value: number | string
	// }

	interface valueExpr {
		type: 'valueExpr',
		child: undefined,
		child2: undefined,
		assignments: undefined,
		datatype: 'string' | 'boolean' | 'number' | 'null' | 'date',
		func: relalgAst.ValueExprFunction,
		args: valueExpr[] | any[],
	}

	interface booleanExpr extends valueExpr { }
}
