# Coach graph v2

The diagram below is generated from the compiled LangGraph graph, not drawn
by hand. Regenerate it with `npm run graph:diagram`; CI can run
`npm run graph:diagram:check` to reject a stale copy.

`log_or_edit_workout` intentionally passes through `confirm_workout_action`
before the guardrail: the graph pauses on `interrupt()` until the user
confirms the write. Conditional-edge labels are not emitted by
LangGraph's `drawMermaid()`, so the branches appear as dotted edges.

<!-- coach-graph-v2:start -->
<!-- Generated from the compiled graph by `npm run graph:diagram`. Do not edit by hand. -->

```mermaid
graph TD;
	__start__ --> load_context;
	confirm_pending_action --> guardrail;
	confirm_workout_action --> guardrail;
	general_chat --> guardrail;
	generate_workout --> guardrail;
	guardrail --> respond;
	load_context --> router;
	nutrition_qa --> guardrail;
	progress_goals --> guardrail;
	respond --> __end__;
	router -.-> generate_workout;
	router -.-> log_or_edit_workout;
	router -.-> progress_goals;
	router -.-> nutrition_qa;
	router -.-> general_chat;
	router -.-> confirm_pending_action;
	log_or_edit_workout -.-> confirm_workout_action;
	log_or_edit_workout -.-> guardrail;
```
<!-- coach-graph-v2:end -->
