
declare namespace trcAst {
	type Operator = '=' | '!=' | '<' | '>' | '<=' | '>='
	type Quantifier = 'EXISTS' | 'FORALL' | '∃' | '∀'
	type LogicalOperator = 'OR' | 'AND' | '∧' | '∨' 

	interface TRC_Expr {
		type: 'TRC_Expr',
		variable: string,
		formula: LogicalExpression
	}

	interface LogicalExpression {
		type: 'LogicalExpression',
		left: AttributeReference | LogicalExpression,
		operator: LogicalOperator,
		right: LogicalExpression | QuantifiedExpression | Predicate
	}

	interface RelationPredicate {
		type: 'RelationPredicate',
		relation: string,
		variable: string 
	}

	interface Predicate {
		type: 'Predicate',
		left: AttributeReference,
		operator: Operator,
		right: AttributeReference | string | number
	}

	interface AttributeReference {
		type: 'AttributeReference',
		variable: string,
		attribute: string
	}

	interface QuantifiedExpression {
		type: 'QuantifiedExpression',
		quantifier: Quantifier,
		variable: string,
		formula: LogicalExpression 
	}

	interface Negation {
		type: 'Negation',
		formula: LogicalExpression
	}
}

/*
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
*/
