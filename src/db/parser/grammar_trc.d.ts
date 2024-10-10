declare namespace trcAst {
	type Operator = '=' | '!=' | '<' | '>' | '<=' | '>='
	type Quantifier = 'exists' | 'forAll'
	type LogicalOperator = 'or' | 'and' | 'implies'

	interface TRC_Expr {
		type: 'TRC_Expr',
		variables: string[],
		projections: Projection[]
		formula: LogicalExpression
	}

	interface Projection {
		variable: string,
		attribute: string,
		alias: string | null
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
		condition: relalgAst.valueExpr
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