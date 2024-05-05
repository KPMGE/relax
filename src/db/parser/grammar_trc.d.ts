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
		predicate: string
	}

	interface Projection {
		type: 'projection',
		relation: string,
		columns: string[]
	}
}
