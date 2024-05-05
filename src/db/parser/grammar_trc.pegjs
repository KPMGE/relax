{
	function createRoot(child) {
		return {
			type: 'trcRoot',
			child,
			child2: undefined
		}
	}

  function createProjection(attributes) {
		let relation = ''
		let columns = []

		if (attributes[0].includes('.')) {
			relation = attributes[0].split('.')[0]
		} else {
			relation = attributes[0]
			attributes.shift()
		}


		attributes.forEach(att => columns.push(att.split('.')[1]))

		return { 
			type: 'projection',
			relation,
			columns
		}
  }

	function createExpression(projection, predicate) {
		return {
			type: 'expression',
			projection,
			predicate,
		}
	}

	function createPredicate(quantifier, relation, relationAlias, condition) {
		return {
			type: 'predicate',
			quantifier,
			relation,
			relationAlias,
			condition,
		}
	}

	function createBooleanExpression(operator, expressions) {
		return {
			type: 'valueExpr',
			datatype: 'boolean',
			func: operator,
			args: expressions,
		}
	}

	function createConstantExpression(value) {
		return {
			type: 'valueExpr',
			datatype: 'number',
			func: 'constant',
			args: [value],
		}
	}

	function createColumnValueExpression(column) {
		return {
			type: 'valueExpr',
			datatype: 'null',
			func: 'columnValue',
			args: [column, null],
		}
	}

		// type: 'valueExpr',
		// child: undefined,
		// child2: undefined,
		// assignments: undefined,
		// datatype: 'string' | 'boolean' | 'number' | 'null' | 'date',
		// func: relalgAst.ValueExprFunction,
		// args: valueExpr[] | any[],


	function createComparison(attribute, operator, value) {
		const columnName = attribute.split('.')[1]
		const columnExp = createColumnValueExpression(columnName)
		const constExp = createConstantExpression(value)
		return createBooleanExpression(operator, [columnExp, constExp])
	}
}

start = r: root {
	return r
}

dbDumpStart = dbDumpRoot
dbDumpRoot = a: all {
	return {
		type: 'groupRoot',
		groups: [],
		codeInfo: undefined,
	}
}

root = exp: expression {
	return createRoot(exp)
}

expression = '{' proj: projection '|' pred: predicate '}' {
	return createExpression(proj, pred)
}

projection =  atts: attributes {
	return createProjection(atts)
}

attributes = first: attribute remain: attribute_list {
   return [first, ...remain]
}

attribute_list = atts: (',' attribute)* {
  return atts.flat().filter(att => att !== ',')
}

attribute = ws ident: identifier ws {
	return ident
}

predicate = ws qnt: quantifier al: alias '∈' rel: relation '(' cond: condition ')' ws {
	return createPredicate(qnt, rel, al, cond)
}

quantifier = ("∃" / "∀")

alias = ws ident: identifier ws {
	return ident
}

condition = ws comp: comparison ws {
	return comp
}

comparison = att: attribute ws op: operator ws val: value {
	return createComparison(att, op, val)
}

operator = ("=" / "!=" / "<" / "<=" / ">" / ">=")

value = (string / number)

string = "'" chs: [a-zA-Z_.]* "'" {
	return chs
}


digit = [0-9]
number = dgs: digit+ {
	return Number(dgs.join(''))
}


relation = ws ident: identifier ws {
	return ident
}

ch = [a-zA-Z0-9_.]

identifier = chars: ch+ {
   return chars.join('')
}

all = chs: .* {
    return chs.join('')
}

ws "whitespace" = [ \t\n\r]*