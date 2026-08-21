export interface ConditionPair {
	key: string;
	value: string;
}

export interface EditQueryParamCondition {
	type: "queryParams";
	pairs: ConditionPair[];
}

export interface EditTimeRangeCondition {
	type: "timeRange";
	timeRangeIds: string[];
}

export type EditCondition = EditQueryParamCondition | EditTimeRangeCondition;
