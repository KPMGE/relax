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

	function createProjection(variable, attribute, alias = null) {
		return { variable, attribute, alias };
	}
}

start
  = _ expr: TRC_Expr _
    {
      return expr
    }

dbDumpStart
  = dbDumpRoot

dbDumpRoot
  = a: all
    {
      return {
        type: 'groupRoot',
        groups: [],
        codeInfo: undefined,
      }
    }

all
  = chs: .*
    {
      return chs.join('')
    }

TRC_Expr
  = '{' _ variable:Variable _ '|' _ formula:Formula _ '}'
    {
      return { type: 'TRC_Expr', variable, formula, projections: [] };
    }
  / '{' _ projections:Projections _ '|' _ formula:Formula _ '}'
    {
			const variable = projections[0].variable
      return { type: 'TRC_Expr', variable, formula, projections };
    }

Formula = LogicalExpression

LogicalExpression 
  = left:BaseFormula right:(_ LogicOp _ BaseFormula)*
    {
      return right.reduce((result, element) => {
        const op = element[1]
        return createLogicalExpression(result, op, element[3]);
      }, left);
    }

AtomicFormula
  = RelationPredicate
  / Predicate

BaseFormula 
  =	AtomicFormula 
  / not _ formula:BaseFormula
    {
      return createNegation(formula);
    }
  / '(' _ formula:Formula _ ')'
    {
      return formula;
    }
  / existentialQuantifier _ variable:Variable _ '(' _ formula:Formula _ ')'
    {
      return createQuantifiedExpression('exists', variable, formula);
    }
  / '(' _ existentialQuantifier _ variable:Variable  _ ')' _ '(' _ formula:Formula _ ')'
    {
      return createQuantifiedExpression('exists', variable, formula);
    }
  / universalQuantifier _ variable:Variable _ '(' _ formula:Formula _ ')'
    {
      return createQuantifiedExpression('forAll', variable, formula);
    }
  / '(' _ universalQuantifier _ variable:Variable _ ')' _ '(' _ formula:Formula _ ')'
    {
      return createQuantifiedExpression('forAll', variable, formula);
    }

existentialQuantifier
  = 'exists'i
  / '∃'

universalQuantifier
  = 'for all'i
  / '∀'

quantifier
  = existentialQuantifier
  / universalQuantifier

RelationPredicate
  = relation:Relation _ '(' _ variable:Variable _ ')'
    {
      return createRelationPredicate(relation, variable);
    }
  / variable:Variable _ ('in'i / '∈') _ relation:Relation
    {
      return createRelationPredicate(relation, variable);
    }

Predicate
  = left:AttributeReference _ operator:RelOp _ right:Value
    {
      return createPredicate(left, operator, right);
    }
  / left:AttributeReference _ operator:RelOp _ right:AttributeReference
    {
      return createPredicate(left, operator, right);
    }

AttributeReference
  = variable:Variable '.' attribute:Attribute
    {
      return { type: 'AttributeReference', variable, attribute };
    }
  / variable:Variable _ '[' _ attribute:Attribute _ ']'
    {
      return { type: 'AttributeReference', variable, attribute };
    }

comparisonOperatorEquals
  = '='

comparisonOperatorNotEquals
  = ('!=' / '<>' / '≠')
    {
      return '!=';
    }

comparisonOperatorGreaterEquals
  = ('>=' / '≥')
    {
      return '>=';
    }

comparisonOperatorGreater
  = '>'

comparisonOperatorLesserEquals
  = ('<=' / '≤')
    {
      return '<=';
    }

comparisonOperatorLesser
  = '<'

RelOp
  = comparisonOperatorEquals
  / comparisonOperatorNotEquals
  / comparisonOperatorGreaterEquals
  / comparisonOperatorLesserEquals
  / comparisonOperatorGreater
  / comparisonOperatorLesser

and 'logical AND'
  = ('and'i / '∧')
    {
      return 'and';
    }

or 'logical OR'
  = ('or'i	/ '∨')
    {
      return 'or';
    }

xor 'logical XOR'
  = ('xor'i / '⊻' / '⊕')
    {
      return 'xor';
    }

implication 'logical IMPLICATION'
  = ('implies'i / '=>' / '⇒')
    {
      return 'implies';
    }

not 'logical NOT'
  = ('not'i / '!' / '¬')
    {
      return '!';
    }

LogicOp
  = and
  / or
  / xor
  / implication

Attribute
  = [a-zA-Z_][a-zA-Z0-9_]*
    {
      return text();
    }

Value
  = 'date'i '(\'' d: DateIso '\')'
    {
      return d;
    }
  /
  "'" chars:[^']* "\'"
    {
      return chars.join('');
    }
  / digits:[0-9]+
    {
      return parseInt(digits.join(''), 10);
    }

String
  = [a-zA-Z_][a-zA-Z0-9_]*
    {
      return text();
    }

Relation = String

Alias = String

Variable = String

Arrow = ('->' / '→')

Projections
  = p: Projection pl: ("," _ Projection)*
    {
      return [p].concat(pl.map(p => p[2]))
    }

Projection
  = variable:Variable "." attribute:Variable _ Arrow _ alias:Alias
		{
			return createProjection(variable, attribute, alias)
		}
	/ variable:Variable _ '[' _ attribute:Variable _ ']' _ Arrow  _ alias:Alias
		{
			return createProjection(variable, attribute, alias)
		}
	/ variable:Variable "." attribute:Variable 
    {
			return createProjection(variable, attribute)
    }
  / variable:Variable _ '[' _ attribute:Variable _ ']'
    {
			return createProjection(variable, attribute)
    }

_ "whitespace"
  = (WhiteSpace / Comment)*

WhiteSpace
  = [ \t\n\r]

Comment
  = SingleLineComment
  / MultiLineComment

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
