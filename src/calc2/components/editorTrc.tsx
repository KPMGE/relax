import { EditorBase, getHintsFromGroup } from "./editorBase";
import { Item } from "./toolbar";
import { Group } from 'calc2/store/groups';
import React from "react";

const NUM_TREE_LABEL_COLORS = 6;
const KEYWORDS_TRC = ['exists', 'forAll', '|', 'and', 'or', 'not', 'implies', '=', 'empty'];

interface Props { 
	group: Group,
	replaceSelection?(text: string): void,
	// relInsertModalToggle: Function,
}

export class EditorTrc extends React.Component<Props> {
	private editorBase: EditorBase | null = null;

	constructor(props: Props) {
		super(props);

		this.replaceText = this.replaceText.bind(this);
	}

	render() {
		// const autoreplaceOperatorsMode: 'none' | 'header' | 'plain2math' | 'math2plain' = 'none';
		const { group } = this.props;
		// TODO: move to state
		// const relations: { [name: string]: Relation } = {};
		// group.tables.forEach(table => {
		// 	relations[table.tableName] = table.relation;
		// });


		return (
			<EditorBase
				textChange={(cm: CodeMirror.Editor) => { } }
				exampleSql={group.exampleSQL}
				exampleRA={group.exampleRA}
				ref={ref => {
					if (ref) {
						this.editorBase = ref;
					}
				}}
				mode="trc"
				// @ts-ignore
				execFunction={}
				tab="trc"
				linterFunction={() => [...KEYWORDS_TRC]}
				getHintsFunction={() => {
					const hints: string[] = [
						...KEYWORDS_TRC,

						// add table and column names
						...getHintsFromGroup(group),
					];
					return hints;
				}}
				enableInlineRelationEditor={true}
				toolbar={[
					{
						math: false,
						items: [
							{
								label: '∃',
								tooltipTitle: 'calc.editors.trc.toolbar.exists',
								tooltip: 'calc.editors.trc.toolbar.exists',
								onClick: item => this.replaceText(item, '∃'),
							},
							{
								label: '∀',
								tooltipTitle: 'calc.editors.trc.toolbar.for-all',
								tooltip: 'calc.editors.trc.toolbar.for-all',
								onClick: item => this.replaceText(item, '∀'),
							},
							{
								label: '∧',
								tooltipTitle: 'calc.editors.trc.toolbar.and',
								tooltip: 'calc.editors.trc.toolbar.and',
								onClick: item => this.replaceText(item, '∧'),
							},
							{
								label: '∨',
								tooltipTitle: 'calc.editors.trc.toolbar.or',
								tooltip: 'calc.editors.trc.toolbar.or',
								onClick: item => this.replaceText(item, '∨'),
							},
							{
								label: '→',
								tooltipTitle: 'calc.editors.trc.toolbar.implies',
								tooltip: 'calc.editors.trc.toolbar.implies',
								onClick: item => this.replaceText(item, '→'),
							},
							{
								label: '¬',
								tooltipTitle: 'calc.editors.trc.toolbar.not',
								tooltip: 'calc.editors.trc.toolbar.not',
								onClick: item => this.replaceText(item, '¬'),
							},
							{
								label: '∅',
								tooltipTitle: 'calc.editors.trc.toolbar.empty',
								tooltip: 'calc.editors.trc.toolbar.empty',
								onClick: item => this.replaceText(item, '∅'),
							},
						],
					},
					{
						math: true,
						items: [
							{
								label: <i className="fa fa-calendar" />,
								onClick: item => this.replaceText(item, `date('1970-01-01')`),
								tooltipTitle: 'calc.editors.sql.toolbar.insert-date',
								tooltip: 'calc.editors.sql.toolbar.insert-date-content',
							},
						],
					},
				]}
			/>
		);

	}

	private replaceText(item: Item, overwrite?: string) {
		if (this.editorBase) {
			this.editorBase.replaceText(item, overwrite);
		}
	}

	public replaceSelection(text: string, overwrite?: string) {
		if (this.editorBase) {
			this.editorBase.replaceSelection(text, overwrite);
		}
	}
}
