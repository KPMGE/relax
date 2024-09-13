{
  function createRelationPredicate(relation, variable) {
    return { type: 'RelationPredicate', relation, variable };
  }

  function createPredicate(left, operator, right) {
    return { type: 'Predicate', left, operator, right };
  }

  function createLogicalExpression(left, operator, right) {
    return { type: 'LogicalExpression', left, operator, right };
  }

  function createQuantifiedExpression(quantifier, variable, formula) {
    return { type: 'QuantifiedExpression', quantifier, variable, formula };
  }

  function createNegation(formula) {
    return { type: 'Negation', formula };
  }

	function translateLogicalOperator(op) {
		const operators = {
			'∨': 'or',
			'∧': 'and',
			'→': 'implies',
		}
		return operators[op] ? operators[op] : op
	}

	function translateRelationalOperator(op) {
		const operators = {
			'≠': '!=',
			'≤': '<=',
			'≥': '>='
		}
		return operators[op] ? operators[op] : op
	}
}

start = _ expr: TRC_Expr _ {
	return expr
}

dbDumpStart = dbDumpRoot
dbDumpRoot = a: all {
	return {
		type: 'groupRoot',
		groups: [],
		codeInfo: undefined,
	}
}

all = chs: .* {
  return chs.join('')
}

TRC_Expr
  = '{' _ variable:Variable _ '|' _ formula:Formula _ '}' {
      return { type: 'TRC_Expr', variable, formula, projections: [] };
    }
		/
		'{' _ projections:Projections _ '|' _ formula:Formula _ '}' {
			const variable = projections[0].variable
			const attributeNames = projections.map(p => p.attribute)
      return { type: 'TRC_Expr', variable, formula, projections: attributeNames };
		}

Formula = LogicalExpression

LogicalExpression 
	= left:BaseFormula right:(_ LogicOp _ BaseFormula)* {
      return right.reduce((result, element) => {
			  const op = translateLogicalOperator(element[1])
        return createLogicalExpression(result, op, element[3]);
      }, left);
    }

AtomicFormula = RelationPredicate / Predicate

BaseFormula 
	=	AtomicFormula 
	/
	('not' / '¬') _ formula:BaseFormula {
      return createNegation(formula);
    }
  / '(' _ formula:Formula _ ')' {
      return formula;
    }
  / ('exists' / '∃') _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('exists', variable, formula);
    }
  / ('forAll' / '∀') _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('forAll', variable, formula);
    }

RelationPredicate
  = relation:Relation '(' variable:Variable ')' {
      return createRelationPredicate(relation, variable);
    }

Predicate
  = left:AttributeReference _ operator:RelOp _ right:Value {
      return createPredicate(left, translateRelationalOperator(operator), right);
    }
  / left:AttributeReference _ operator:RelOp _ right:AttributeReference {
      return createPredicate(left, translateRelationalOperator(operator), right);
    }

AttributeReference
  = variable:Variable '.' attribute:Attribute {
      return { type: 'AttributeReference', variable, attribute };
    }

RelOp = ('=' / '!=' / '<=' / '>=' / '<' / '>' / '≠' / '≤' / '≥')

LogicOp = ('or' / '∨' / 'and' / '∧' / 'implies' / '→')

Variable
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Attribute
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Value
  = 'date'i '(\'' d: DateIso '\')' {
		return d;
	}
	/
	"'" chars:[^']* "\'" {
      return chars.join('');
    }
  / digits:[0-9]+ {
      return parseInt(digits.join(''), 10);
    }

Relation
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Projections
  = p: Projection pl: ("," _ Projection)* {
      return [p].concat(pl.map(p => p[2]))
    }

Projection
  = variable:Variable "." attribute:Variable {
      return { variable, attribute }
    }

_ "whitespace"
  = (WhiteSpace / Comment)*

WhiteSpace
  = [ \t\n\r]

Comment
  = SingleLineComment / MultiLineComment

SingleLineComment
  = '--' (![\n\r] .)*

MultiLineComment
  = '/*' (!'*/' .)* '*/'

DateIso 'date in ISO format (YYYY-MM-DD)'
= year:$([0-9][0-9][0-9][0-9]) '-' month:$([0-9][0-9]) '-' day:$([0-9][0-9])
	{
		year = parseInt(year, 10);
		month = parseInt(month, 10)-1;
		day = parseInt(day, 10);
		var date = new Date(year, month, day);

		if(date.getFullYear() != year || date.getMonth() != month ||  date.getDate() != day){
			error(t('db.messages.parser.error-invalid-date-format', {str: text()}));
		}
		return date;
	}